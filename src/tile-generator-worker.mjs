import { WorkerRpc } from '@wtrpc/core'
import { parentPort } from 'node:worker_threads';
import { ConfigProviderMemory } from '@basemaps/config';
import { QuadKey } from '@basemaps/geo';
import { handler } from '@basemaps/lambda-tiler';
import { Config, LogConfig } from '@basemaps/shared';
import { fsa } from '@chunkd/fs';
import { LambdaUrlRequest } from '@linzjs/lambda';
import pLimit from 'p-limit';

const Q = pLimit(2)

let count = 0;
let skipped = 0;

const worker = new WorkerRpc({
    async tile(tiles) {
        const logger = LogConfig.get().child({ workerId: worker.id, messageId: worker.messageCount });
        logger.info({ count, skipped }, 'TaskCount')

        let lastTime = performance.now()
        // for 
        const todo = tiles.map(qk => {
            return Q(async () => {
                const tile = QuadKey.toTile(qk)
                count++;
                if (count % 100 == 0) {
                    let duration = performance.now() - lastTime;
                    lastTime = Number(performance.now().toFixed(4))
                    logger.info({ count, total: tiles.length, duration }, 'Progress')
                }

                const outputFile = `./tiles/${tile.z}/${tile.x}/${tile.y}.webp`;
                const exists = await fsa.exists(outputFile)
                if (exists) {
                    skipped++;
                    return
                };
                const request = new LambdaUrlRequest(
                    {
                        requestContext: { http: { method: 'GET' } },
                        headers: new Map(),
                        rawPath: `/v1/tiles/aerial/WebMercatorQuad/${tile.z}/${tile.x}/${tile.y}.webp`,
                        rawQueryString: '?api=c01g9nhbksre481y0x9zk7g3g2t',
                        isBase64Encoded: false,
                    },
                    {},
                    logger,
                );

                logger.trace({ url: request.url }, 'Starting')
                let reqStartTime = performance.now()
                const res = await handler.router.handle(request).catch(e => {
                    console.log(e)
                })
                const duration = Number((performance.now() - reqStartTime).toFixed(2))
                logger.debug({ url: request.url, duration  }, 'Starting:Done')


                if (res.status !== 200) {
                    console.log(res)
                    throw Error()
                }

                await fsa.write(outputFile, Buffer.from(res.body, 'base64'))

            })
        })

        try {
            await Promise.all(todo)
        } catch (e) {
            console.log(e)
        }
    }
})

worker.onStart = async () => {
    console.log('WorkerStarted', worker.threadId)
    const configJson = await fsa.readJson('./config-latest.json');
    const mem = ConfigProviderMemory.fromJson(configJson);
    mem.createVirtualTileSets();
    Config.setConfigProvider(mem);
}


if (parentPort) worker.bind(parentPort);
