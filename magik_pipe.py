"""Ordered, reference-only pipes with frontend-managed socket shapes."""
from dataclasses import dataclass
import re

PIPE_TYPE = "MAGIK_PIPE"


class AnyType(str):
    def __ne__(self, other):
        return False


ANY = AnyType("*")


class DynamicInputs(dict):
    def __contains__(self, key):
        return isinstance(key, str) and re.fullmatch(r"input_[1-9]\d*", key) is not None

    def __getitem__(self, key):
        if key in self:
            return (ANY, {"forceInput": True})
        raise KeyError(key)


class DynamicOutputs(tuple):
    """Advertise two sockets, but allow validation of every dynamic index."""
    def __getitem__(self, index):
        if isinstance(index, int) and index >= 0:
            return ANY
        return super().__getitem__(index)


@dataclass(frozen=True)
class MagikPipe:
    values: tuple


class MagikPipeIn:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"input_1": (ANY, {"forceInput": True}),
                             "input_2": (ANY, {"forceInput": True})},
                "optional": DynamicInputs()}

    RETURN_TYPES = (PIPE_TYPE,)
    RETURN_NAMES = ("Magik Pipe",)
    FUNCTION = "pack"
    CATEGORY = "Magik/Pipe"

    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        return True

    def pack(self, **kwargs):
        indices = sorted(int(k[6:]) for k in kwargs if re.fullmatch(r"input_[1-9]\d*", k))
        if len(indices) < 2 or indices != list(range(1, len(indices) + 1)):
            raise ValueError("Magik Pipe In needs at least two connected inputs, with no gaps.")
        return (MagikPipe(tuple(kwargs[f"input_{i}"] for i in indices)),)


class MagikPipeOut:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"pipe": (PIPE_TYPE,)}}

    RETURN_TYPES = DynamicOutputs((ANY, ANY))
    # Do not define OUTPUT_IS_LIST: ComfyUI derives its length from the actual
    # returned tuple. A fixed two-element flag tuple would truncate outputs.
    FUNCTION = "unpack"
    CATEGORY = "Magik/Pipe"

    def unpack(self, pipe):
        if not isinstance(pipe, MagikPipe):
            raise TypeError("Magik Pipe Out requires a Magik Pipe In output.")
        return pipe.values


NODE_CLASS_MAPPINGS = {"MagikPipeIn": MagikPipeIn, "MagikPipeOut": MagikPipeOut}
NODE_DISPLAY_NAME_MAPPINGS = {"MagikPipeIn": "Magik Pipe In", "MagikPipeOut": "Magik Pipe Out"}
