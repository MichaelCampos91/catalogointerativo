import assert from "node:assert/strict"
import { completedSearchTerm, matchesSearch } from "../lib/search"
import {
  buildFolderPath,
  categoryMatchesQuery,
  escapeLikePattern,
  parseTagList,
  replaceOwnSearchTags,
  splitTagInput,
  tagsForPath,
} from "../lib/folder-tags"

assert.equal(matchesSearch("Chá de Bebê", "cha bebe"), true)
assert.equal(matchesSearch("Safari", "ursinho"), false)

const parsed = parseTagList(["  Chá Bebê ", "cha bebe", "azul"])
assert.equal(parsed.error, `A tag "cha bebe" está repetida`)

const ok = parseTagList(["Chá de Bebê", "azul", "festa junina"])
assert.deepEqual(ok.tags, ["Chá de Bebê", "azul", "festa junina"])
assert.equal(parseTagList(["um dois tres quatro"]).error, "Cada tag pode ter no máximo 3 palavras")
assert.equal(parseTagList(["!!!"]).error, "Tag inválida")
assert.equal(parseTagList(Array.from({ length: 31 }, (_, index) => `tag ${index}`)).error?.includes("30"), true)

const split = splitTagInput("azul, chá de bebê, ")
assert.deepEqual(split.committed, ["azul", "chá de bebê"])
assert.equal(split.remainder, " ")

assert.equal(buildFolderPath("", "Safari"), "Safari")
assert.equal(buildFolderPath("files/Safari", "Leoes"), "Safari/Leoes")
assert.equal(buildFolderPath("../etc", "Safari"), null)
assert.equal(buildFolderPath("Safari", "../Leoes"), "Safari/Leoes")
assert.equal(buildFolderPath("Safari", ".."), null)

assert.equal(escapeLikePattern("100%_off"), "100#%#_off")
assert.equal(escapeLikePattern("foo#"), "foo##")

const tags = new Map<string, string[]>([
  ["Safari", ["leão"]],
  ["Safari/Leoes", ["rei da selva"]],
  ["SafariExtra", ["outro"]],
])
assert.deepEqual(tagsForPath(tags, "Safari"), { own: ["leão"], related: ["leão", "rei da selva"] })

const byName = categoryMatchesQuery(
  { name: "Safari", images: [{ name: "a.jpg", code: "a" }, { name: "b.jpg", code: "b" }] },
  "safari",
  []
)
assert.equal(byName.include, true)
assert.equal(byName.images.length, 2)

const byTag = categoryMatchesQuery(
  { name: "Safari", images: [{ name: "a.jpg", code: "a" }] },
  "rei da selva",
  ["rei da selva"]
)
assert.equal(byTag.include, true)
assert.equal(byTag.images.length, 1)

const byCode = categoryMatchesQuery(
  {
    name: "Safari",
    images: [
      { name: "URS-1.jpg", code: "URS-1" },
      { name: "URS-2.jpg", code: "URS-2" },
    ],
  },
  "urs-1",
  []
)
assert.equal(byCode.include, true)
assert.deepEqual(byCode.images.map((image) => image.code), ["URS-1"])

assert.equal(completedSearchTerm("ab"), null)
assert.equal(completedSearchTerm("a b"), null)
assert.equal(completedSearchTerm("!!!"), null)
assert.equal(completedSearchTerm("Ursínho"), "ursinho")
assert.equal(completedSearchTerm("  Chá   de Bebê "), "cha de bebe")

assert.deepEqual(replaceOwnSearchTags(["leão"], ["leão", "rei da selva"], ["azul"]), ["azul", "rei da selva"])

console.log("check-folder-tags: ok")
