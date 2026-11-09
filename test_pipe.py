import unittest
from magik_pipe import MagikPipeIn, MagikPipeOut, ANY

class PipeTests(unittest.TestCase):
    def test_order_identity_and_dynamic_merge(self):
        values = [object() for _ in range(24)]
        data = {f'input_{i+1}': values[i] for i in reversed(range(24))}
        pipe, = MagikPipeIn().pack(**data)
        result = MagikPipeOut().unpack(pipe)
        self.assertEqual(len(result), 24)
        for i, value in enumerate(values):
            self.assertIs(result[i], value)
            self.assertEqual(MagikPipeOut.RETURN_TYPES[i], ANY)
        # Mirrors execution.py's default merge_result_data branch.
        flags = [False] * len(result)
        merged = [[result[i]] for i, flag in zip(range(len(result)), flags)]
        self.assertEqual(len(merged), 24)
        self.assertIs(merged[23][0], values[23])

    def test_dynamic_input_validation(self):
        optional = MagikPipeIn.INPUT_TYPES()['optional']
        self.assertIn('input_20', optional)
        self.assertNotIn('input_0', optional)
        self.assertEqual(optional['input_20'][0], ANY)

    def test_invalid_shape(self):
        for data in ({'input_1': 1}, {'input_1': 1, 'input_3': 3}):
            with self.assertRaises(ValueError):
                MagikPipeIn().pack(**data)
        with self.assertRaises(TypeError):
            MagikPipeOut().unpack(('wrong',))

    def test_payloads_not_flattened(self):
        a, b = [1, 2], {'samples': object()}
        p, = MagikPipeIn().pack(input_1=a, input_2=b)
        out = MagikPipeOut().unpack(p)
        self.assertIs(out[0], a)
        self.assertIs(out[1], b)

if __name__ == '__main__':
    unittest.main()
