import json
import pytest
import torch
from antenna_ml.data.dataset import AntennaS11Dataset
from antenna_ml.data.normalization import MinMaxNormalizer


@pytest.fixture
def dummy_dataset_file(tmp_path):
    data = [
        {
            "params": {"l": 0.1, "w": 0.01},
            "s11": [{"real": -1, "imag": -2}, {"real": -3, "imag": -4}],
        },
        {
            "params": {"l": 0.2, "w": 0.02},
            "s11": [{"real": -5, "imag": -6}, {"real": -7, "imag": -8}],
        },
    ]

    filepath = tmp_path / "data.jsonl"
    with open(filepath, "w") as f:
        for item in data:
            f.write(json.dumps(item) + "\n")
    return filepath, data


def test_dataset_loading_and_len(dummy_dataset_file):
    filepath, data = dummy_dataset_file

    # Fit normalizer
    all_params = [d["params"] for d in data]
    normalizer = MinMaxNormalizer()
    normalizer.fit(all_params)

    dataset = AntennaS11Dataset(data_path=str(filepath), normalizer=normalizer)
    assert len(dataset) == 2


def test_dataset_getitem(dummy_dataset_file):
    filepath, data = dummy_dataset_file

    all_params = [d["params"] for d in data]
    normalizer = MinMaxNormalizer()
    normalizer.fit(all_params)

    dataset = AntennaS11Dataset(data_path=str(filepath), normalizer=normalizer)

    # Test first item
    inputs, targets = dataset[0]

    # Check input tensor (normalized). Normalizer sorts keys, so 'l' is first.
    # l=0.1 is min -> 0.0; w=0.01 is min -> 0.0
    expected_inputs = torch.tensor([0.0, 0.0], dtype=torch.float32)
    torch.testing.assert_close(inputs, expected_inputs)

    # Check target tensor
    expected_targets = torch.tensor([-1, -2, -3, -4], dtype=torch.float32)
    torch.testing.assert_close(targets, expected_targets)

    # Test second item
    inputs, targets = dataset[1]

    # Check input tensor (normalized)
    # l=0.2 is max -> 1.0; w=0.02 is max -> 1.0
    expected_inputs = torch.tensor([1.0, 1.0], dtype=torch.float32)
    torch.testing.assert_close(inputs, expected_inputs)

    # Check target tensor
    expected_targets = torch.tensor([-5, -6, -7, -8], dtype=torch.float32)
    torch.testing.assert_close(targets, expected_targets)
