import { fsa } from '@chunkd/fs'
import tj from 'togeojson';
import { DOMParser } from 'xmldom';
import cover from '@mapbox/tile-cover'
import { QuadKey } from '@basemaps/geo';
import tb from 'turf-buffer';

const BufferAmountKm = 0.1;

async function main() {
    const fc = { 'type': 'FeatureCollection', features: [] };

    console.time('gpx:convert')
    for await (const file of fsa.list('./route')) {
        if (!file.endsWith('.gpx')) continue;

        const buf = await fsa.read(file);
        const geojson = tj.gpx(new DOMParser().parseFromString(buf.toString()))
        for (const feat of geojson.features) fc.features.push(feat);
    }

    console.timeEnd('gpx:convert')
    await fsa.write('route.geojson', JSON.stringify(fc))

    console.time('route:buffer:0.1km');
    const buffered = tb(fc, BufferAmountKm, 'kilometers')
    await fsa.write('route.buffered.geojson', JSON.stringify(buffered))
    console.timeEnd('route:buffer:0.1km');


    function addChildren(qk, maxZoom) {
        if (qk.length > maxZoom) return
        allTiles.add(qk);
        for (const child of QuadKey.children(qk)) addChildren(child, maxZoom)
    }

    const allTiles = new Set();
    console.time('tile:cover')
    const tileCover = { type: 'FeatureCollection', features: [] }
    for (const feat of buffered.features) {
        const ret = cover.geojson(feat.geometry, { min_zoom: 5, max_zoom: 15 })
        for (const f of ret.features) tileCover.features.push(f);


        for (const maxZoom of [15, 18]) {
            const tiles = cover.tiles(feat.geometry, { min_zoom: 5, max_zoom: maxZoom })

            for (const tile of tiles) {
                const qk = QuadKey.fromTile({ x: tile[0], y: tile[1], z: tile[2] })
                addChildren(qk, maxZoom + 1);
                allTiles.add(qk)

                let current = qk.slice(0, qk.length - 1)
                while (current.length > 0) {
                    if (allTiles.has(current)) break
                    allTiles.add(current)
                    current = current.slice(0, current.length - 1)
                }
            }
        }
    }
    console.timeEnd('tile:cover')
    await fsa.write('data/route.tiles.geojson', JSON.stringify(tileCover))
    const tiles = [...allTiles];
    console.log('Tiles', tiles.length)
    await fsa.write('data/tiles.json', JSON.stringify({ tiles }))
}

main()