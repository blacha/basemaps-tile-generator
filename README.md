# @basemaps/tile-generator

Create a folder called `route/` and put `gpx` files into

Load all the data from `route/*.gpx` and create a tile covering
```
node src/create-tile-cover.mjs
```


Load the output `data/tiles.json` and start generating tiles
```
node src/tile-generator.mjs
```

Bundle the tiles from `tiles/*` into mbtiles

```
node src/create-mbtiles.mjs
```