"""Adaptador POS: SOLO stored procedures (sp_*).
Productos, stock, checkout, ventas y descuentos.
Sin ORM ni SQL directo a tablas."""
import json
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import DBAPIError
from fastapi import HTTPException
from app.core.config import settings


def _sp_error(exc: DBAPIError, default: str) -> HTTPException:
    msg = str(exc.orig) if exc.orig else str(exc)
    for code, status in (("USUARIO_EXISTE", 409), ("SKU_EXISTE", 409),
                         ("SIN_STOCK", 400), ("CARRITO_VACIO", 400),
                         ("CANTIDAD_INVALIDA", 400),
                         ("PRODUCTO_NO_EXISTE", 404),
                         ("VENTA_NO_EXISTE", 404),
                         ("USUARIO_NO_EXISTE", 404),
                         ("SIN_PERMISO_VENTA", 403),
                         ("EMAIL_EXISTE", 409),
                         ("EMAIL_INVALIDO", 400),
                         ("ALCANCE_INVALIDO", 400),
                         ("PAGO_INVALIDO", 400),
                         ("DESCUENTO_INVALIDO", 400),
                         ("DESCUENTO_NO_EXISTE", 404),
                         ("ROL_INVALIDO", 400), ("DATOS_INVALIDOS", 400),
                         ("IMAGEN_INVALIDA", 400),
                         ("DEPARTAMENTO_INVALIDO", 400),
                         ("STOCK_INVALIDO", 400)):
        if code in msg:
            return HTTPException(status, msg.split("\n")[0])
    return HTTPException(500, default)


def _product(r) -> dict:
    return {"id": r.o_id, "name": r.o_name, "sku": r.o_sku,
            "price": float(r.o_price), "stock": r.o_stock,
            "category": r.o_category, "discount": float(r.o_desc or 0),
            "image_url": r.o_image or "",
            "description": r.o_features or ""}


def list_products(db: Session) -> list[dict]:
    rows = db.execute(text("SELECT * FROM sp_list_products()")).fetchall()
    return [_product(r) for r in rows]


def list_available(db: Session) -> list[dict]:
    """Solo existencias: lo unico que ve el cliente."""
    rows = db.execute(
        text("SELECT * FROM sp_list_products_available()")).fetchall()
    return [_product(r) for r in rows]


def create_product(db: Session, name: str, sku: str | None, price: float,
                   stock: int, category: str, image_url: str = "",
                   description: str = "") -> int:
    try:
        pid = db.execute(
            text("SELECT sp_create_product(:n,:s,:p,:t,:c,:i,:d)"),
            {"n": name, "s": sku, "p": price, "t": stock,
             "c": category, "i": image_url, "d": description}).scalar()
        db.commit()
        return pid
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo crear el producto")


def update_product(db: Session, product_id: int, name: str | None,
                   price: float | None, image_url: str | None,
                   description: str | None = None) -> dict:
    """Admin edita nombre, precio, imagen y caracteristicas."""
    try:
        db.execute(
            text("SELECT sp_update_product(:i,:n,:p,:m,:d)"),
            {"i": product_id, "n": name, "p": price,
             "m": image_url, "d": description})
        db.commit()
        row = db.execute(
            text("SELECT * FROM sp_list_products() WHERE o_id = :i"),
            {"i": product_id}).fetchone()
        if not row:
            raise HTTPException(404, "PRODUCTO_NO_EXISTE")
        return _product(row)
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo actualizar el producto")


def set_stock(db: Session, product_id: int, stock: int) -> dict:
    """Reabastecimiento admin: sin limite superior."""
    try:
        row = db.execute(
            text("SELECT * FROM sp_set_stock(:i,:s)"),
            {"i": product_id, "s": stock}).fetchone()
        db.commit()
        return _product(row)
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo actualizar el stock")


def reserve(db: Session, holder: str, product_id: int,
            qty: int) -> dict:
    """Aparta stock al agregar al carrito (sp_reserve_stock)."""
    try:
        row = db.execute(
            text("SELECT * FROM sp_reserve_stock(:h,:p,:q)"),
            {"h": holder, "p": product_id, "q": qty}).fetchone()
        db.commit()
        return {"stock": row.o_stock, "reserved": row.o_reserved}
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo apartar el producto")


def release(db: Session, holder: str, product_id: int,
            qty: int | None) -> dict:
    """Devuelve stock al quitar del carrito (sp_release_stock)."""
    try:
        row = db.execute(
            text("SELECT * FROM sp_release_stock(:h,:p,:q)"),
            {"h": holder, "p": product_id, "q": qty}).fetchone()
        db.commit()
        return {"stock": row.o_stock, "reserved": row.o_reserved}
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo liberar el producto")


def my_cart(db: Session, holder: str) -> list[dict]:
    """Carrito persistente del holder (reservas vigentes)."""
    rows = db.execute(
        text("SELECT * FROM sp_my_reservations(:h)"),
        {"h": holder}).fetchall()
    return [{"product_id": r.o_product_id, "qty": r.o_qty}
            for r in rows]


def move_cart(db: Session, from_holder: str, to_holder: str) -> dict:
    """Migra carrito de invitado a la cuenta al iniciar sesion."""
    n = db.execute(
        text("SELECT sp_move_reservations(:f,:t)"),
        {"f": from_holder, "t": to_holder}).scalar()
    db.commit()
    return {"moved": n or 0}


def preview(db: Session, items: list[dict],
            user_id: int | None) -> dict:
    """Vista previa del ticket sin mover stock (sp_cart_preview)."""
    try:
        row = db.execute(
            text("SELECT * FROM sp_cart_preview(:u,:i,:d)"),
            {"u": user_id, "i": json.dumps(items),
             "d": settings.FIRST_PURCHASE_DISCOUNT}).fetchone()
        return {"subtotal": float(row.o_subtotal),
                "admin_disc": float(row.o_admin_disc),
                "first_disc": float(row.o_first_disc),
                "discount": float(row.o_discount),
                "iva": float(row.o_iva), "total": float(row.o_total),
                "detalle": row.o_detalle or ""}
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo calcular el total")


def checkout(db: Session, items: list[dict], user_id: int | None,
             buyer_name: str = "invitado", holder: str = "",
             pay_method: str = "efectivo") -> dict:
    """Toda la transaccion (consumir reservas, descuentos, IVA 16%,
    metodo de pago) ocurre dentro de sp_checkout en la DB."""
    try:
        row = db.execute(
            text("SELECT * FROM sp_checkout(:u,:b,:i,:d,:h,:m)"),
            {"u": user_id, "b": buyer_name,
             "i": json.dumps(items),
             "d": settings.FIRST_PURCHASE_DISCOUNT,
             "h": holder, "m": pay_method}).fetchone()
        db.commit()
        return {"id": row.o_sale_id, "subtotal": float(row.o_subtotal),
                "discount": float(row.o_discount),
                "iva": float(row.o_iva), "total": float(row.o_total),
                "detalle": row.o_detalle or "",
                "pay_method": pay_method}
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo completar la compra")


def list_sales(db: Session, role: str, user_id: int | None) -> list[dict]:
    rows = db.execute(
        text("SELECT * FROM sp_list_sales(:r,:u)"),
        {"r": role, "u": user_id}).fetchall()
    return [{"id": r.o_id, "buyer_name": r.o_buyer,
             "subtotal": float(r.o_subtotal),
             "discount": float(r.o_discount), "iva": float(r.o_iva),
             "total": float(r.o_total),
             "created_at": r.o_created.isoformat() if r.o_created else None,
             "items": r.o_items, "detalle": r.o_detalle or "",
             "pay_method": r.o_payment or "efectivo"}
            for r in rows]


def get_sale(db: Session, sale_id: int, role: str,
             user_id: int | None) -> dict:
    """Encabezado de la venta para el ticket descargable."""
    try:
        r = db.execute(
            text("SELECT * FROM sp_get_sale(:s,:r,:u)"),
            {"s": sale_id, "r": role, "u": user_id}).fetchone()
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo consultar la venta")
    if not r:
        raise HTTPException(404, "VENTA_NO_EXISTE")
    return {"id": r.o_id, "buyer_name": r.o_buyer,
            "subtotal": float(r.o_subtotal),
            "discount": float(r.o_discount), "iva": float(r.o_iva),
            "total": float(r.o_total),
            "created_at": r.o_created.isoformat() if r.o_created else None,
            "detalle": r.o_detalle or "",
            "pay_method": r.o_payment or "efectivo"}


def sale_items(db: Session, sale_id: int, role: str,
               user_id: int | None) -> list[dict]:
    try:
        rows = db.execute(
            text("SELECT * FROM sp_sale_items(:s,:r,:u)"),
            {"s": sale_id, "r": role, "u": user_id}).fetchall()
        return [{"product": r.o_product, "qty": r.o_qty,
                 "unit_price": float(r.o_unit_price)} for r in rows]
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo consultar la venta")


def list_departments(db: Session) -> list[dict]:
    rows = db.execute(text("SELECT * FROM sp_list_departments()")).fetchall()
    return [{"id": r.o_id, "name": r.o_name} for r in rows]


def departments_with_counts(db: Session) -> list[dict]:
    rows = db.execute(
        text("SELECT * FROM sp_departments_with_counts()")).fetchall()
    return [{"id": r.o_id, "name": r.o_name, "products": r.o_products}
            for r in rows]


def low_stock(db: Session) -> list[dict]:
    """Alerta automatica: productos con menos de 5 (notifica al admin)."""
    rows = db.execute(text("SELECT * FROM sp_low_stock()")).fetchall()
    return [{"id": r.o_id, "name": r.o_name, "sku": r.o_sku,
             "price": float(r.o_price), "stock": r.o_stock,
             "category": r.o_category, "image_url": r.o_image or "",
             "description": r.o_features or ""}
            for r in rows]


def set_discount(db: Session, scope: str, target: str,
                 percent: float) -> dict:
    """Admin crea/actualiza descuento por seccion o producto."""
    try:
        did = db.execute(
            text("SELECT sp_set_discount(:s,:t,:p)"),
            {"s": scope, "t": target, "p": percent}).scalar()
        db.commit()
        return {"id": did}
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo guardar el descuento")


def list_discounts(db: Session) -> list[dict]:
    rows = db.execute(text("SELECT * FROM sp_list_discounts()")).fetchall()
    return [{"id": r.o_id, "scope": r.o_scope, "target": r.o_target,
             "percent": float(r.o_percent), "active": r.o_active}
            for r in rows]


def toggle_discount(db: Session, discount_id: int, active: bool) -> dict:
    try:
        db.execute(text("SELECT sp_toggle_discount(:i,:a)"),
                   {"i": discount_id, "a": active})
        db.commit()
        return {"id": discount_id, "active": active}
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo cambiar el descuento")


def delete_discount(db: Session, discount_id: int) -> dict:
    try:
        db.execute(text("SELECT sp_delete_discount(:i)"),
                   {"i": discount_id})
        db.commit()
        return {"id": discount_id, "deleted": True}
    except DBAPIError as exc:
        db.rollback()
        raise _sp_error(exc, "No se pudo eliminar el descuento")


def dashboard_stats(db: Session) -> dict:
    r = db.execute(text("SELECT * FROM sp_dashboard_stats()")).fetchone()
    return {"ventas": r.o_ventas, "ingresos": float(r.o_ingresos),
            "bajo_stock": r.o_bajo_stock, "usuarios": r.o_usuarios,
            "alertas": r.o_alertas}


def list_users(db: Session) -> list[dict]:
    rows = db.execute(text("SELECT * FROM sp_list_users()")).fetchall()
    return [{"id": r.o_id, "username": r.o_username,
             "full_name": r.o_full_name, "role": r.o_role,
             "first_purchase_done": r.o_first_purchase_done,
             "disabled": r.o_disabled, "email": r.o_email or "",
             "address": r.o_address or ""} for r in rows]
