import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('openajang', ROOT / 'tools/openajang.py')
oa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oa)
CASES = json.loads((ROOT / 'tests/conformance/cases.json').read_text())
BASE = json.loads((ROOT / 'examples/pycon-davao-2026.openajang.json').read_text())

class ConformanceTest(unittest.TestCase):
    def test_corpus(self):
        for case in CASES:
            with self.subTest(case=case['name']):
                try:
                    if 'raw' in case:
                        data = oa.loads(case['raw'])
                    else:
                        data = copy.deepcopy(BASE)
                        for path, value in case['changes'].items():
                            parts = path.split('.')
                            current = data
                            for key in parts[:-1]: current = current[key]
                            current[parts[-1]] = value
                    oa.validate(data)
                    valid = True
                except (ValueError, TypeError):
                    valid = False
                self.assertEqual(valid, case['valid'])
