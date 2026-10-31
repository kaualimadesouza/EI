import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from topa_api.domain.escpos import (
    CMD_ALIGN_CENTER,
    CMD_ALIGN_LEFT,
    CMD_ALIGN_RIGHT,
    CMD_BOLD_OFF,
    CMD_BOLD_ON,
    CMD_CUT_FULL,
    CMD_CUT_PARTIAL,
    CMD_DOUBLE_SIZE_OFF,
    CMD_DOUBLE_SIZE_ON,
    CMD_INIT,
    EscPosEmulator,
    cmd_feed_lines,
    render_customer_receipt,
    render_kitchen_ticket,
)
from topa_api.domain.fiscal import build_fiscal_document, get_store_fiscal_profile
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

SP_TZ = ZoneInfo("America/Sao_Paulo")


def test_cmd_feed_lines_clamping() -> None:
    assert cmd_feed_lines(0) == b"\x1bd\x01"
    assert cmd_feed_lines(5) == b"\x1bd\x05"
    assert cmd_feed_lines(500) == b"\x1bd\xff"


def test_render_kitchen_ticket_and_emulator() -> None:
    order = Order(
        id=uuid.uuid4(),
        store_slug="lanchonete-bem-te-vi",
        number=42,
        business_date=date(2026, 10, 30),
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.PIX,
        items=(
            OrderItem("misto", "Misto Quente", 2, 1200),
            OrderItem("suco", "Suco de Laranja", 1, 800),
        ),
        created_at=datetime(2026, 10, 30, 11, 45, 0, tzinfo=SP_TZ),
    )
    raw = render_kitchen_ticket(order, "Bem-te-vi Lanches")
    assert isinstance(raw, bytes)
    assert CMD_INIT in raw
    assert CMD_CUT_PARTIAL in raw
    assert b"PEDIDO #42" in raw
    assert b"COZINHA: BEM-TE-VI LANCHES" in raw
    assert b"NO LOCAL" in raw

    lines = EscPosEmulator.decode(raw)
    assert len(lines) > 0
    assert any("PEDIDO #42" in item_line.text for item_line in lines)
    assert any(item_line.is_cut for item_line in lines)

    text_view = EscPosEmulator.to_text(raw)
    assert "PEDIDO #42" in text_view
    assert "Misto Quente" in text_view


def test_render_customer_receipt_with_and_without_fiscal_doc() -> None:
    order = Order(
        id=uuid.uuid4(),
        store_slug="lanchonete-bem-te-vi",
        number=10,
        business_date=date(2026, 10, 30),
        status=OrderStatus.DELIVERED,
        dine_in=False,
        payment_method=PaymentMethod.CARD,
        items=(OrderItem("coxinha", "Coxinha de Frango", 1, 900),),
        created_at=datetime(2026, 10, 30, 12, 15, 0, tzinfo=SP_TZ),
    )
    profile = get_store_fiscal_profile("lanchonete-bem-te-vi")

    # Without fiscal doc
    raw_no_fiscal = render_customer_receipt(order, profile, None)
    assert b"DOCUMENTO AUXILIAR DA NFC-e" in raw_no_fiscal
    assert b"PAGAMENTO (CARD)" in raw_no_fiscal
    assert b"PARA LEVAR" in raw_no_fiscal

    # With fiscal doc
    fiscal_doc = build_fiscal_document(order, profile)
    raw_with_fiscal = render_customer_receipt(order, profile, fiscal_doc)
    assert b"CHAVE DE ACESSO" in raw_with_fiscal
    assert fiscal_doc.formatted_access_key.encode("utf-8") in raw_with_fiscal

    lines = EscPosEmulator.decode(raw_with_fiscal)
    assert any(entry.align == "center" for entry in lines)
    assert any(entry.align == "right" for entry in lines)

    text_view = EscPosEmulator.to_text(raw_with_fiscal)
    assert "CHAVE DE ACESSO" in text_view


def test_escpos_emulator_full_coverage() -> None:
    # Build raw bytes exercising all emulator branches
    buf = bytearray()
    buf.extend(CMD_INIT)
    buf.extend(CMD_ALIGN_CENTER)
    buf.extend(b"Centered Text\n")
    buf.extend(CMD_ALIGN_RIGHT)
    buf.extend(b"Right Text\n")
    buf.extend(CMD_ALIGN_LEFT)
    buf.extend(CMD_BOLD_ON)
    buf.extend(b"Bold Left\n")
    buf.extend(CMD_BOLD_OFF)
    buf.extend(CMD_DOUBLE_SIZE_ON)
    buf.extend(b"Double Size\n")
    buf.extend(CMD_DOUBLE_SIZE_OFF)
    buf.extend(cmd_feed_lines(2))
    buf.extend(b"\r\n")
    buf.extend(CMD_CUT_FULL)

    lines = EscPosEmulator.decode(bytes(buf))
    text_repr = EscPosEmulator.to_text(bytes(buf))

    assert any(e.text == "Centered Text" and e.align == "center" for e in lines)
    assert any(e.text == "Right Text" and e.align == "right" for e in lines)
    assert any(e.text == "Bold Left" and e.bold for e in lines)
    assert any(e.text == "Double Size" and e.double_size for e in lines)
    assert any(e.is_cut for e in lines)
    assert "Centered Text" in text_repr
    assert "--------------------------------" in text_repr
