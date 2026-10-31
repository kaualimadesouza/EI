"""Business-rule violations. The message is what the customer reads at the kiosk, or the
lojista on the dashboard, so it is pt-BR copy; presentation only picks the HTTP status."""


class DomainError(Exception):
    pass


class EmptyOrderError(DomainError):
    def __init__(self) -> None:
        super().__init__("Adicione pelo menos um produto ao pedido.")


class QuantityOutOfRangeError(DomainError):
    def __init__(self, minimum: int, maximum: int) -> None:
        super().__init__(f"Escolha de {minimum} a {maximum} unidades de cada produto.")


class UnknownProductError(DomainError):
    def __init__(self, product_id: str) -> None:
        super().__init__("Um dos produtos não está mais no cardápio.")
        self.product_id = product_id


class ProductUnavailableError(DomainError):
    def __init__(self, product_name: str) -> None:
        super().__init__(f"{product_name} esgotou.")


class StoreNotFoundError(DomainError):
    def __init__(self) -> None:
        super().__init__("Loja não encontrada.")


class OrderNotFoundError(DomainError):
    def __init__(self) -> None:
        super().__init__("Pedido não encontrado.")


class ProductNotFoundError(DomainError):
    def __init__(self) -> None:
        super().__init__("Produto não encontrado.")


class DuplicateProductError(DomainError):
    def __init__(self) -> None:
        super().__init__("Produto já cadastrado.")


class StatusChangeNotAllowedError(DomainError):
    def __init__(self, number: int, current: str, requested: str) -> None:
        super().__init__(f"O pedido {number:03d} não pode passar de {current} para {requested}.")


class InvalidCredentialsError(DomainError):
    def __init__(self) -> None:
        super().__init__("E-mail ou senha incorretos.")


class InvalidTokenError(DomainError):
    def __init__(self, message: str = "Sessão inválida ou expirada.") -> None:
        super().__init__(message)


class ForbiddenStoreAccessError(DomainError):
    def __init__(self) -> None:
        super().__init__("Acesso não permitido para esta loja.")


class RateLimitExceededError(DomainError):
    def __init__(self, retry_after: int = 60) -> None:
        super().__init__("Muitos pedidos enviados. Aguarde um momento.")
        self.retry_after = retry_after


class InvalidProductDataError(DomainError):
    def __init__(self, message: str = "Dados do produto inválidos.") -> None:
        super().__init__(message)


class EmailAlreadyInUseError(DomainError):
    def __init__(self, message: str = "E-mail já está em uso.") -> None:
        super().__init__(message)


class InvalidCustomerDataError(DomainError):
    def __init__(self, message: str = "Dados de cliente inválidos.") -> None:
        super().__init__(message)


class InvalidIdempotencyKeyError(DomainError):
    def __init__(self) -> None:
        super().__init__("Chave de idempotência inválida.")


class IdempotencyConflictError(DomainError):
    def __init__(self) -> None:
        super().__init__("Chave de idempotência já utilizada com parâmetros diferentes.")


class DuplicateClientOrderIdError(DomainError):
    def __init__(self) -> None:
        super().__init__("Identificador de pedido do cliente já registrado.")
