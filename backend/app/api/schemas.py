from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    full_name: str
    role: str
    first_purchase_done: bool = False
    email: str = ""


class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: str = ""
    email: str = ""


class ProfileResponse(BaseModel):
    username: str
    full_name: str
    role: str
    first_purchase_done: bool = False
    email: str = ""
    address: str = ""


class UpdateProfileRequest(BaseModel):
    full_name: str = ""
    email: str = ""
    address: str = ""


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ProductOut(BaseModel):
    id: int
    name: str
    sku: str
    price: float
    stock: int
    category: str = "General"
    discount: float = 0
    image_url: str = ""
    description: str = ""

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str
    sku: str = ""
    price: float
    stock: int = 0
    category: str = "General"
    image_url: str = ""
    description: str = ""


class ProductUpdate(BaseModel):
    name: str | None = None
    price: float | None = None
    image_url: str | None = None
    description: str | None = None


class StockUpdate(BaseModel):
    stock: int


class CartItem(BaseModel):
    product_id: int
    qty: int = 1


class CheckoutRequest(BaseModel):
    items: list[CartItem]
    buyer_name: str = "invitado"
    holder: str = ""
    pay_method: str = "efectivo"


class PreviewRequest(BaseModel):
    items: list[CartItem]


class CartOp(BaseModel):
    holder: str
    product_id: int
    qty: int | None = None


class MigrateRequest(BaseModel):
    from_holder: str


class SaleOut(BaseModel):
    id: int
    buyer_name: str
    subtotal: float
    discount: float
    total: float


class DiscountIn(BaseModel):
    scope: str  # seccion | producto
    target: str  # nombre de categoria o SKU
    percent: float


class DiscountOut(BaseModel):
    id: int
    scope: str
    target: str
    percent: float
    active: bool


class DiscountToggle(BaseModel):
    active: bool
