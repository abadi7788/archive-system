import unittest

from app.services.storage_service import S3Storage


class FakePaginator:
    def paginate(self, **kwargs):
        if kwargs != {"Bucket": "archive-test"}:
            raise AssertionError(f"Unexpected paginator arguments: {kwargs}")
        return [
            {"Contents": [{"Key": "folder/a.pdf"}, {"Key": "folder/b.png"}]},
            {"Contents": [{"Key": "orphan.bin"}]},
        ]


class FakeS3Client:
    def get_paginator(self, operation):
        if operation != "list_objects_v2":
            raise AssertionError(f"Unexpected operation: {operation}")
        return FakePaginator()


class S3StorageListingTests(unittest.IsolatedAsyncioTestCase):
    async def test_lists_all_paginated_keys(self):
        storage = object.__new__(S3Storage)
        storage.client = FakeS3Client()
        storage.bucket = "archive-test"
        self.assertEqual(
            await storage.list_keys(),
            ["folder/a.pdf", "folder/b.png", "orphan.bin"],
        )


if __name__ == "__main__":
    unittest.main()
