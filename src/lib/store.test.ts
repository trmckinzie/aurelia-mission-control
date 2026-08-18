import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mutateCollection, readCollection } from "@/lib/store";

interface Item {
  id: string;
  value: number;
}

describe("store", () => {
  // Unique collection name per run so this never touches real app data
  // (agents.json / goals.json) and parallel test runs can't collide.
  const collection = `__test_store_${randomUUID()}`;
  const filePath = path.join(process.cwd(), ".aurelia", "data", `${collection}.json`);

  after(async () => {
    await rm(filePath, { force: true });
  });

  test("readCollection returns [] for a collection that doesn't exist yet", async () => {
    const items = await readCollection<Item>(`__test_nonexistent_${randomUUID()}`);
    assert.deepEqual(items, []);
  });

  test("mutateCollection appends and persists an item", async () => {
    await mutateCollection<Item>(collection, (items) => [...items, { id: "a", value: 1 }]);
    const items = await readCollection<Item>(collection);
    assert.deepEqual(items, [{ id: "a", value: 1 }]);
  });

  describe("concurrent mutations", () => {
    const concurrentCollection = `__test_store_concurrent_${randomUUID()}`;
    const concurrentFilePath = path.join(process.cwd(), ".aurelia", "data", `${concurrentCollection}.json`);

    after(async () => {
      await rm(concurrentFilePath, { force: true });
    });

    test("10 concurrent appends all land, none lost, file stays valid JSON", async () => {
      // Regression test for a real bug: concurrent writes previously collided
      // on a Date.now()-keyed temp filename and corrupted the file, and the
      // read-modify-write cycle wasn't serialized, so concurrent writers
      // could silently clobber each other's changes.
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          mutateCollection<Item>(concurrentCollection, (items) => [...items, { id: `item-${i}`, value: i }])
        )
      );

      const items = await readCollection<Item>(concurrentCollection);
      assert.equal(items.length, 10);
      const ids = items.map((i) => i.id).sort();
      assert.deepEqual(
        ids,
        Array.from({ length: 10 }, (_, i) => `item-${i}`).sort()
      );
    });

    test("10 concurrent updates to the same item all apply in order, none dropped", async () => {
      await mutateCollection<Item>(concurrentCollection, () => [{ id: "counter", value: 0 }]);

      await Promise.all(
        Array.from({ length: 10 }, () =>
          mutateCollection<Item>(concurrentCollection, (items) =>
            items.map((i) => (i.id === "counter" ? { ...i, value: i.value + 1 } : i))
          )
        )
      );

      const items = await readCollection<Item>(concurrentCollection);
      const counter = items.find((i) => i.id === "counter");
      // If any update raced on a stale read, this would be less than 10.
      assert.equal(counter?.value, 10);
    });
  });
});
