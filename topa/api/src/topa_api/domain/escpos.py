from dataclasses import dataclass
from zoneinfo import ZoneInfo

from topa_api.domain.fiscal import FiscalDocument, StoreFiscalProfile
from topa_api.domain.orders import Order

BUSINESS_TIMEZONE = ZoneInfo("America/Sao_Paulo")

# ESC/POS byte sequence control codes
CMD_INIT = b"\x1b@"
CMD_ALIGN_LEFT = b"\x1ba\x00"
CMD_ALIGN_CENTER = b"\x1ba\x01"
CMD_ALIGN_RIGHT = b"\x1ba\x02"
CMD_BOLD_ON = b"\x1bE\x01"
CMD_BOLD_OFF = b"\x1bE\x00"
CMD_DOUBLE_SIZE_ON = b"\x1d!\x11"
CMD_DOUBLE_SIZE_OFF = b"\x1d!\x00"
CMD_CUT_PARTIAL = b"\x1dV\x42\x00"
CMD_CUT_FULL = b"\x1dV\x41\x00"


def cmd_feed_lines(lines: int) -> bytes:
    clamped = max(1, min(lines, 255))
    return b"\x1bd" + bytes([clamped])


@dataclass(frozen=True)
class EmulatorLine:
    text: str
    align: str = "left"
    bold: bool = False
    double_size: bool = False
    is_cut: bool = False


class EscPosEmulator:
    @classmethod
    def decode(cls, data: bytes) -> list[EmulatorLine]:
        lines: list[EmulatorLine] = []
        i = 0
        current_align = "left"
        current_bold = False
        current_double = False
        current_buffer = bytearray()

        def flush_buffer() -> None:
            nonlocal current_buffer
            if current_buffer:
                raw_str = current_buffer.decode("utf-8", errors="replace").strip("\r")
                if raw_str:
                    lines.append(
                        EmulatorLine(
                            text=raw_str,
                            align=current_align,
                            bold=current_bold,
                            double_size=current_double,
                        )
                    )
                current_buffer = bytearray()

        while i < len(data):
            if data[i : i + 2] == b"\x1b@":
                flush_buffer()
                current_align = "left"
                current_bold = False
                current_double = False
                i += 2
            elif data[i : i + 3] == b"\x1ba\x00":
                flush_buffer()
                current_align = "left"
                i += 3
            elif data[i : i + 3] == b"\x1ba\x01":
                flush_buffer()
                current_align = "center"
                i += 3
            elif data[i : i + 3] == b"\x1ba\x02":
                flush_buffer()
                current_align = "right"
                i += 3
            elif data[i : i + 3] == b"\x1bE\x01":
                flush_buffer()
                current_bold = True
                i += 3
            elif data[i : i + 3] == b"\x1bE\x00":
                flush_buffer()
                current_bold = False
                i += 3
            elif data[i : i + 3] == b"\x1d!\x11":
                flush_buffer()
                current_double = True
                i += 3
            elif data[i : i + 3] == b"\x1d!\x00":
                flush_buffer()
                current_double = False
                i += 3
            elif data[i : i + 4] in (b"\x1dV\x42\x00", b"\x1dV\x41\x00"):
                flush_buffer()
                lines.append(EmulatorLine(text="=== CORTE DE PAPEL ===", is_cut=True))
                i += 4
            elif data[i : i + 2] == b"\x1bd":
                flush_buffer()
                i += 3
            else:
                if data[i] == 0x0A:
                    flush_buffer()
                else:
                    current_buffer.append(data[i])
                i += 1

        flush_buffer()
        return lines

    @classmethod
    def to_text(cls, data: bytes) -> str:
        lines = cls.decode(data)
        out: list[str] = []
        for line in lines:
            if line.is_cut:
                out.append("--------------------------------")
            elif line.align == "center":
                out.append(f"{line.text:^32}")
            elif line.align == "right":
                out.append(f"{line.text:>32}")
            else:
                out.append(line.text)
        return "\n".join(out)


def render_kitchen_ticket(order: Order, store_name: str) -> bytes:
    issued_at = order.created_at.astimezone(BUSINESS_TIMEZONE)
    dest = "NO LOCAL" if order.dine_in else "PARA LEVAR"
    time_str = issued_at.strftime("%H:%M:%S")
    date_str = issued_at.strftime("%d/%m/%Y")

    buf = bytearray()
    buf.extend(CMD_INIT)
    buf.extend(CMD_ALIGN_CENTER)
    buf.extend(CMD_DOUBLE_SIZE_ON)
    buf.extend(CMD_BOLD_ON)
    buf.extend(f"PEDIDO #{order.number}\n".encode())
    buf.extend(CMD_DOUBLE_SIZE_OFF)
    buf.extend(CMD_BOLD_OFF)
    buf.extend(f"COZINHA: {store_name.upper()}\n".encode())
    buf.extend(f"TIPO: {dest}\n".encode())
    buf.extend(f"HORARIO: {time_str} ({date_str})\n".encode())
    buf.extend(b"--------------------------------\n")
    buf.extend(CMD_ALIGN_LEFT)
    for item in order.items:
        buf.extend(CMD_BOLD_ON)
        buf.extend(f"{item.quantity}x  {item.name}\n".encode())
        buf.extend(CMD_BOLD_OFF)
    buf.extend(b"--------------------------------\n")
    buf.extend(cmd_feed_lines(3))
    buf.extend(CMD_CUT_PARTIAL)
    return bytes(buf)


def render_customer_receipt(
    order: Order,
    store_profile: StoreFiscalProfile,
    fiscal_doc: FiscalDocument | None = None,
) -> bytes:
    issued_at = order.created_at.astimezone(BUSINESS_TIMEZONE)
    dest = "NO LOCAL" if order.dine_in else "PARA LEVAR"
    time_str = issued_at.strftime("%d/%m/%Y %H:%M:%S")

    buf = bytearray()
    buf.extend(CMD_INIT)
    buf.extend(CMD_ALIGN_CENTER)
    buf.extend(CMD_BOLD_ON)
    buf.extend(f"{store_profile.trade_name.upper()}\n".encode())
    buf.extend(CMD_BOLD_OFF)
    buf.extend(f"CNPJ: {store_profile.cnpj}\n".encode())
    address_line = (
        f"{store_profile.street}, {store_profile.number} - "
        f"{store_profile.city}/{store_profile.uf}\n"
    )
    buf.extend(address_line.encode())
    buf.extend(b"--------------------------------\n")
    buf.extend(b"DOCUMENTO AUXILIAR DA NFC-e\n")
    buf.extend(f"PEDIDO #{order.number} ({dest})\n".encode())
    buf.extend(f"EMISSAO: {time_str}\n".encode())
    buf.extend(b"--------------------------------\n")
    buf.extend(CMD_ALIGN_LEFT)
    buf.extend(b"QTD  ITEM                 VALOR\n")
    for item in order.items:
        item_total_reais = (item.quantity * item.unit_price_cents) / 100.0
        short_name = (item.name[:18]).ljust(18)
        line = f"{item.quantity:>2}x  {short_name} {item_total_reais:>6.2f}\n"
        buf.extend(line.encode("utf-8"))

    buf.extend(b"--------------------------------\n")
    buf.extend(CMD_ALIGN_RIGHT)
    buf.extend(CMD_BOLD_ON)
    total_reais = order.total_cents / 100.0
    buf.extend(f"TOTAL: R$ {total_reais:.2f}\n".encode())
    buf.extend(CMD_BOLD_OFF)
    pay_label = order.payment_method.value.upper()
    buf.extend(f"PAGAMENTO ({pay_label}): R$ {total_reais:.2f}\n".encode())

    if fiscal_doc is not None:
        tax_reais = fiscal_doc.approx_tax_cents / 100.0
        buf.extend(f"Trib. Aprox. (IBPT): R$ {tax_reais:.2f}\n".encode())
        buf.extend(CMD_ALIGN_CENTER)
        buf.extend(b"--------------------------------\n")
        buf.extend(b"CHAVE DE ACESSO\n")
        buf.extend(f"{fiscal_doc.formatted_access_key}\n".encode())
        buf.extend(b"CONSULTE VIA QR CODE:\n")
        buf.extend(f"{fiscal_doc.qr_code_url}\n".encode())

    buf.extend(cmd_feed_lines(3))
    buf.extend(CMD_CUT_PARTIAL)
    return bytes(buf)
