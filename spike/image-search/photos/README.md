# Real-photo test set

Put 50–100 private card photos in this folder. Image files are ignored by
`spike/image-search/.gitignore` and must not be committed.

Create `labels.csv` beside the photos with this header:

```csv
filename,card_key,notes
```

Example:

```csv
charizard_front.jpg,en:base1-4,holo glare
pikachu_phone.png,en:swsh4-44,tilted
```

`card_key` may use either the TCGdex card ID (`base1-4`) or the full catalog key
(`en:base1-4`). The evaluator resolves either form against the generated
manifest. Keep filenames unique and use relative filenames only.
