# @basemaps/tile-generator

You need access to [linz/basemaps](https://github.com/linz/basemaps) S3 Buckets of imagery for this to work.


Create a folder called `route/` and put `gpx` files into

Load all the data from `route/*.gpx` and create a tile covering
```
node src/create-tile-cover.mjs
```

Load the output `data/tiles.json` and start generating tiles
```
node src/tile-generator.mjs
node src/tile-generator.mjs --reverse # Run a second node process backwards through the imagery
```

Bundle the tiles from `tiles/*` into mbtiles

```
node src/create-mbtiles.mjs
```

