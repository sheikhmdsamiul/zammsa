from django.contrib import admin
from .models import (
    BudgetAllocation, BudgetEncumbrance, GoodsReceiptNote, GRNLineItem,
    Invoice, InvoiceLineItem, ThreeWayMatch, Payment, LetterOfCredit,
)

admin.site.register(BudgetAllocation)
admin.site.register(BudgetEncumbrance)
admin.site.register(GoodsReceiptNote)
admin.site.register(GRNLineItem)
admin.site.register(Invoice)
admin.site.register(InvoiceLineItem)
admin.site.register(ThreeWayMatch)
admin.site.register(Payment)
admin.site.register(LetterOfCredit)
