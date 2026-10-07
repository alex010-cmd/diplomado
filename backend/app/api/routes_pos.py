"""POS: productos, stock, checkout, ventas, ticket y descuentos.
Todo via stored procedures + limpieza de datos de entrada."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps, sanitize, schemas
from app.domain.user import User
from app.infrastructure import pos_repo
from app.infrastructure.db import get_db

router = APIRouter(prefix="/api", tags=["pos"])


@router.get("/products", response_model=list[schemas.ProductOut])
def products(db: Session = Depends(get_db),
             current: User = Depends(deps.get_current_user)):
    return pos_repo.list_products(db)


@router.get("/departments", response_model=list[dict])
def departments(db: Session = Depends(get_db),
                 current: User = Depends(deps.get_current_user)):
    """Areas de la tienda (para el alta de productos del admin)."""
    return pos_repo.list_departments(db)


@router.get("/departments/counts", response_model=list[dict])
def departments_counts(db: Session = Depends(get_db),
                       current: User = Depends(deps.require_roles("admin"))):
    """Departamentos con total de productos (popup de descuentos)."""
    return pos_repo.departments_with_counts(db)


@router.get("/products/available", response_model=list[schemas.ProductOut])
def products_available(db: Session = Depends(get_db)):
    """Catalogo publico: solo existencias (lo que ve el cliente)."""
    return pos_repo.list_available(db)


@router.post("/products", response_model=dict, status_code=201)
def create_product(body: schemas.ProductCreate,
                   db: Session = Depends(get_db),
                   current: User = Depends(deps.require_roles("admin"))):
    name = sanitize.clean_text(body.name, "Nombre", 120)
    # SKU autoasignado (depto + producto + stock); solo se valida si se envia
    sku = (sanitize.clean_sku(body.sku)
           if (body.sku or "").strip() else None)
    if not (body.category or "").strip():
        raise HTTPException(400, "Elige el departamento del producto")
    category = sanitize.clean_text(body.category, "Departamento", 60)
    image_url = sanitize.clean_image_url(body.image_url or "")
    description = sanitize.clean_description(body.description or "",
                                             required=True)
    if not (0 <= body.price <= 9999999):
        raise HTTPException(400, "Precio invalido")
    if not (0 <= body.stock <= 999999999):
        raise HTTPException(400, "Stock invalido")
    pid = pos_repo.create_product(db, name, sku, float(body.price),
                                  int(body.stock), category, image_url,
                                  description)
    return {"id": pid}


@router.patch("/products/{product_id}")
def update_product(product_id: int, body: schemas.ProductUpdate,
                   db: Session = Depends(get_db),
                   current: User = Depends(deps.require_roles("admin"))):
    """Admin edita nombre, precio e imagen (solo lo enviado)."""
    if product_id <= 0:
        raise HTTPException(400, "Producto invalido")
    name = (sanitize.clean_text(body.name, "Nombre", 120)
            if body.name is not None else None)
    price = None
    if body.price is not None:
        if not (0 <= body.price <= 9999999):
            raise HTTPException(400, "Precio invalido")
        price = float(body.price)
    image_url = (sanitize.clean_image_url(body.image_url)
                 if body.image_url is not None else None)
    description = (sanitize.clean_description(body.description)
                   if body.description is not None else None)
    return pos_repo.update_product(db, product_id, name, price, image_url,
                                   description)


@router.patch("/products/{product_id}/stock")
def set_stock(product_id: int, body: schemas.StockUpdate,
              db: Session = Depends(get_db),
              current: User = Depends(deps.require_roles("admin"))):
    """Reabastecimiento admin: fija el stock final (sin limite)."""
    if product_id <= 0 or body.stock < 0 or body.stock > 999999999:
        raise HTTPException(400, "Stock invalido")
    return pos_repo.set_stock(db, product_id, int(body.stock))


def _only_client(current: User) -> User:
    # Comprar exige cuenta: solo cliente registrado (ni invitado ni admin).
    if current.role != "cliente":
        raise HTTPException(403, "Inicia sesion con tu cuenta de cliente")
    return current


@router.post("/cart/reserve")
def cart_reserve(body: schemas.CartOp, db: Session = Depends(get_db),
                 current: User = Depends(deps.require_roles("cliente"))):
    """Agregar al carrito: aparta stock en la DB (evita duplicados/-1)."""
    _only_client(current)
    holder = f"u:{current.username}"
    if body.product_id <= 0 or not body.qty or not (1 <= body.qty <= 999):
        raise HTTPException(400, "Cantidad invalida")
    return pos_repo.reserve(db, holder, body.product_id, body.qty)


@router.post("/cart/release")
def cart_release(body: schemas.CartOp, db: Session = Depends(get_db),
                 current: User = Depends(deps.require_roles("cliente"))):
    """Quitar del carrito: devuelve stock (linea completa si qty es null)."""
    _only_client(current)
    holder = f"u:{current.username}"
    if body.product_id <= 0:
        raise HTTPException(400, "Producto invalido")
    if body.qty is not None and not (1 <= body.qty <= 999):
        raise HTTPException(400, "Cantidad invalida")
    return pos_repo.release(db, holder, body.product_id, body.qty)


def _clean_items(body_items) -> list[dict]:
    if not body_items:
        raise HTTPException(400, "Carrito vacio")
    items = []
    for i in body_items:
        if i.product_id <= 0 or not (1 <= i.qty <= 999):
            raise HTTPException(400, "Cantidad invalida")
        items.append({"product_id": i.product_id, "qty": i.qty})
    return items


@router.get("/cart/mine")
def cart_mine(db: Session = Depends(get_db),
              current: User = Depends(deps.require_roles("cliente"))):
    """Carrito persistente del cliente (sobrevive navegacion y logout)."""
    _only_client(current)
    return pos_repo.my_cart(db, f"u:{current.username}")


@router.post("/cart/migrate")
def cart_migrate(body: schemas.MigrateRequest, db: Session = Depends(get_db),
                 current: User = Depends(deps.get_current_user)):
    """Al iniciar sesion: mueve lo de invitado (g:xxx) a mi cuenta."""
    if current.role != "cliente":
        raise HTTPException(403, "Solo los clientes tienen carrito")
    from_holder = sanitize.clean_holder(body.from_holder)
    if not from_holder.startswith("g:"):
        raise HTTPException(400, "Origen invalido")
    return pos_repo.move_cart(db, from_holder, f"u:{current.username}")


@router.post("/cart/preview", response_model=dict)
def cart_preview(body: schemas.PreviewRequest,
                 db: Session = Depends(get_db),
                 current: User = Depends(deps.require_roles("cliente"))):
    """Ticket en vivo del carrito: total, descuentos e IVA sin vender."""
    _only_client(current)
    return pos_repo.preview(db, _clean_items(body.items), current.id)


@router.post("/sales/checkout", response_model=dict, status_code=201)
def checkout(body: schemas.CheckoutRequest,
             db: Session = Depends(get_db),
             current: User = Depends(deps.require_roles("cliente"))):
    """Compra solo con cuenta de cliente (invitado y admin bloqueados).
    1ra compra: 15% automatico. La tarjeta NUNCA llega aqui."""
    _only_client(current)
    items = _clean_items(body.items)
    holder = f"u:{current.username}"
    pay_method = sanitize.clean_pay_method(body.pay_method)
    sale = pos_repo.checkout(db, items, current.id, current.username,
                             holder, pay_method)
    return {**sale, "wants_register_prompt": False}


@router.get("/sales")
def sales(db: Session = Depends(get_db),
          current: User = Depends(deps.get_current_user)):
    """admin ve todo; cliente solo lo suyo."""
    return pos_repo.list_sales(db, current.role, current.id)


@router.get("/sales/{sale_id}/ticket")
def ticket(sale_id: int, db: Session = Depends(get_db),
           current: User = Depends(deps.get_current_user)):
    """Datos del ticket descargable: encabezado + lineas."""
    header = pos_repo.get_sale(db, sale_id, current.role, current.id)
    lines = pos_repo.sale_items(db, sale_id, current.role, current.id)
    return {**header, "items": lines}


@router.get("/sales/{sale_id}/items")
def sale_detail(sale_id: int, db: Session = Depends(get_db),
                current: User = Depends(deps.get_current_user)):
    return pos_repo.sale_items(db, sale_id, current.role, current.id)


@router.get("/low-stock", response_model=list[schemas.ProductOut])
def low_stock(db: Session = Depends(get_db),
              current: User = Depends(deps.require_roles("admin"))):
    """Notificaciones automaticas: productos con menos de 5."""
    return pos_repo.low_stock(db)


@router.get("/discounts", response_model=list[schemas.DiscountOut])
def discounts(db: Session = Depends(get_db),
              current: User = Depends(deps.get_current_user)):
    return pos_repo.list_discounts(db)


@router.post("/discounts", response_model=dict, status_code=201)
def set_discount(body: schemas.DiscountIn, db: Session = Depends(get_db),
                 current: User = Depends(deps.require_roles("admin"))):
    """Admin agrega descuento a una seccion o producto especifico."""
    scope = sanitize.clean_text(body.scope, "Alcance", 20).lower()
    if scope not in ("seccion", "producto"):
        raise HTTPException(400, "Alcance invalido")
    if scope == "producto":
        target = sanitize.clean_sku(body.target)
    else:
        target = sanitize.clean_text(body.target, "Seccion", 60)
    try:
        percent = float(body.percent)
    except (TypeError, ValueError):
        raise HTTPException(400, "Porcentaje invalido")
    if not (0 < percent <= 90):
        raise HTTPException(400, "Porcentaje invalido (1-90)")
    return pos_repo.set_discount(db, scope, target, percent)


@router.patch("/discounts/{discount_id}")
def toggle_discount(discount_id: int, body: schemas.DiscountToggle,
                    db: Session = Depends(get_db),
                    current: User = Depends(deps.require_roles("admin"))):
    return pos_repo.toggle_discount(db, discount_id, bool(body.active))


@router.delete("/discounts/{discount_id}")
def delete_discount(discount_id: int, db: Session = Depends(get_db),
                    current: User = Depends(deps.require_roles("admin"))):
    return pos_repo.delete_discount(db, discount_id)


@router.get("/health")
def health():
    return {"status": "ok"}
