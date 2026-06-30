from django.test import TestCase

from zammsa_backend.utils import (
    ID_PREFIXES,
    generate_traceable_id,
    is_traceable_id,
    needs_traceable_id_regeneration,
    normalize_department_code,
    parse_traceable_id,
    normalize_fiscal_year_code,
)


class DummyModel:
    objects = None


class TraceableIdUtilsTests(TestCase):
    def test_parse_valid_id(self):
        parsed = parse_traceable_id('REQ-2026-PRC-00042')
        self.assertEqual(parsed['prefix'], 'REQ')
        self.assertEqual(parsed['fiscal_year'], '2026')
        self.assertEqual(parsed['department'], 'PRC')
        self.assertEqual(parsed['sequence'], 42)

    def test_parse_valid_app_id_without_department(self):
        parsed = parse_traceable_id('APP-2026-00042')
        self.assertEqual(parsed['prefix'], 'APP')
        self.assertEqual(parsed['fiscal_year'], '2026')
        self.assertIsNone(parsed['department'])
        self.assertEqual(parsed['sequence'], 42)

    def test_is_traceable_id_rejects_legacy_values(self):
        self.assertFalse(is_traceable_id('SOL-001'))
        self.assertFalse(is_traceable_id('PO-CON-12345'))

    def test_needs_regeneration_for_legacy_contract_numbers(self):
        self.assertTrue(needs_traceable_id_regeneration('PO-CON-12345', 'PO'))
        self.assertFalse(needs_traceable_id_regeneration('PO-2026-PRC-00001', 'PO'))

    def test_prefix_registry_covers_procurement_chain(self):
        expected = {'APP', 'REQ', 'CPP', 'GPN', 'SOL', 'BID', 'BER', 'CON', 'PO', 'GRN', 'INV'}
        self.assertTrue(expected.issubset(set(ID_PREFIXES.keys())))

    def test_generate_traceable_id_format(self):
        class StubManager:
            def filter(self, **_kwargs):
                return self

            def values_list(self, *_args, **_kwargs):
                return []

        class StubModel:
            objects = StubManager()

        trace_id = generate_traceable_id('REQ', 'prc', StubModel, 'req_number', '2026')
        self.assertTrue(is_traceable_id(trace_id))
        self.assertEqual(trace_id, 'REQ-2026-PRC-00001')

    def test_generate_traceable_id_normalizes_split_fiscal_year(self):
        class StubManager:
            def filter(self, **_kwargs):
                return self

            def values_list(self, *_args, **_kwargs):
                return []

        class StubModel:
            objects = StubManager()

        trace_id = generate_traceable_id('APP', 'prc', StubModel, 'app_number', '2026/2027')
        self.assertEqual(normalize_fiscal_year_code('2026/2027'), '2026')
        self.assertEqual(trace_id, 'APP-2026-00001')

    def test_generate_traceable_id_normalizes_long_department_code(self):
        class StubManager:
            def filter(self, **_kwargs):
                return self

            def values_list(self, *_args, **_kwargs):
                return []

        class StubModel:
            objects = StubManager()

        trace_id = generate_traceable_id('APP', 'PHARMACY', StubModel, 'app_number', '2026')
        self.assertEqual(normalize_department_code('PHARMACY'), 'PHA')
        self.assertEqual(trace_id, 'APP-2026-00001')

    def test_generate_increments_sequence(self):
        class StubManager:
            def __init__(self):
                self.values = []

            def filter(self, **_kwargs):
                return self

            def values_list(self, *_args, **_kwargs):
                return self.values

        class StubModel:
            objects = StubManager()

        first = generate_traceable_id('SOL', 'FIN', StubModel, 'sol_number', '2026')
        StubModel.objects.values.append(first)
        second = generate_traceable_id('SOL', 'FIN', StubModel, 'sol_number', '2026')
        self.assertEqual(parse_traceable_id(first)['sequence'] + 1, parse_traceable_id(second)['sequence'])
