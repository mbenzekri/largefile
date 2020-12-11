window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

function initfs(nbytes) {
    return new Promise((resolve, reject) => {
        window.requestFileSystem(window.PERSISTENT, nbytes, fs => {
            navigator.webkitPersistentStorage.requestQuota(nbytes,
                granted => resolve(fs),
                error => {
                    resolve(null);
                }
            )
        })
    })
}

/**
 * 
 * @param {FileSystemFileEntry} fileEntry 
 * @param {Blob} blob 
 */
function write(fileEntry, offset, blob) {
    return new Promise((resolve, reject) => {
        fileEntry.createWriter(
            fileWriter => {
                const size = blob.size
                fileWriter.onwriteend = e => resolve(e.total)
                fileWriter.onerror = e => reject(e.target.error)
                fileWriter.seek(offset)
                //setTimeout(_ => fileWriter.write(blob),100)
                fileWriter.write(blob)
                blob = null
            },
            e => reject(e.target.error)
        );
    })
}

function create(fs, filename) {
    return new Promise((resolve, reject) => {
        fs.root.getFile(filename, { create: true },
            fileEntry => resolve(fileEntry),
            e => reject(e.target.error)
        )
    })
}
function log(str) {
    const log = document.body
    const div = document.createElement('div')
    div.innerHTML = str
    log.appendChild(div)

}

async function estimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        await navigator.storage.estimate()
            .then(estimate => log(`<h4>Storage usage  = ${estimate.usage},  quota = ${estimate.quota}</h4>`))
            .catch(e => log(`<h4>Estimating storage fail,  error = ${e ? e.toString() : 'undifined'}</h4>`));
    } else {
        log('<h4>No storage estimation API available</h4>')
    }
    if ('webkitPersistentStorage' in navigator && 'queryUsageAndQuota' in navigator.webkitPersistentStorage) {
        await new Promise(function (resolve, reject) {
            navigator.webkitPersistentStorage.queryUsageAndQuota((usage, quota) => {
                log(`<h4>Persitent Storage  = ${usage},  Quota = ${quota}</h4>`)
                resolve()
            }, resolve);
        });
    }
}



async function largefile() {
    const start = Date.now()
    const fs = await initfs(10 * 1024 * 1024 * 1024)
    for (name of [0,1,2,3,4,5].map( i => `largefile${i}.dat`)) {
        const file = await create(fs, name)
        let size = 0
        log(`<u>File ${name} created, start writing</u>`)
        for (let i = 0; i < 100; i++) {
            const array = new Uint8Array(100 * 1024 * 1024)
            array.fill(i)
            const blob = new Blob([array])
            const written = await write(file, size, blob )
            size += written
            log(`<li>chunk ${i}: written = ${size} in ${Date.now() - start} msec</li>`)
        }
        log(`<li>File ${name} finished to write</li>`)
    }

}

async function cachefiles() {
    const name = 'BCJ'
    const parcel = '../geo/BCJ/FDP/F_PARCEL.geojson'
    const cache = await caches.open(name)
    log(`<h4>Cache "${name}" opened</h4>`)
    const req = new Request()
    const resp1 = await fetch(parcel)
    //const blob1 = await resp1.blob()
    //await cache.add(parcel)
    await cache.put(parcel, resp1)
    log(`<h4>${parcel} added to cache "${name}" </h4>`)
    const resp2 = await cache.match(parcel)
    log(`<h4>$response retreived from cache "${name}" </h4>`)
    const blob = await resp2.blob()
    log(`<h4>blob of ${blob.size} bytes retreived response </h4>`)
    const chunksize = 50 * 1024 * 1024
    let read = 0
    const loop = (resolve, reject, offset = 0) => {
        if (read >= blob.size) return resolve()
        const chunk = blob.slice(offset, offset + chunksize)
        const reader = new FileReader()
        reader.onerror = _ => reject(`Error while reading chunk ${i} offset=${offset} due to ${reader.error} `)
        reader.onload = evt => { read += reader.result.byteLength; log(`read chunk of size ${reader.result.byteLength}`) }
        reader.onloadend = _ => loop(resolve, reject, read)
        reader.readAsArrayBuffer(chunk)
    }
    await new Promise(loop)
}


async function partialfiles() {
    const name = 'BCJ'
    const parcel = '../geo/BCJ/FDP/F_PARCEL.geojson'
    await caches.delete(name)
    const cache = await caches.open(name)
    log(`<h4>Cache "${name}" opened</h4>`)

    // caching 
    const partsize = 200000000
    let cached = 0
    let offset = 0
    let part = 0
    do {
        const partname = parcel.replace(/\.geojson$/, `${part}.geojson`)
        const response = await fetch(`${parcel}?start=${offset}&end=${offset + partsize - 1}`)
        const blob = await response.blob()
        if (blob.size > 0) {
            await cache.put(partname, new Response(blob))
            log(`<h4>added  ${partname}</h4>`)
        }
        part++
        offset += blob.size
        cached = blob.size
    } while (cached === partsize);

    // reading 
    part = 0
    let response
    do {
        const partname = parcel.replace(/\.geojson$/, `${part}.geojson`)
        response = await cache.match(partname)
        if (response) {
            log(`<h4>${partname} response found </h4>`)
            const blob = await response.blob()
            log(`<h4>blob of ${blob.size} bytes retreived </h4>`)
            const chunksize = 50 * 1024 * 1024
            let read = 0
            const loop = (resolve, reject, offset = 0) => {
                if (read >= blob.size) return resolve()
                const chunk = blob.slice(offset, offset + chunksize)
                const reader = new FileReader()
                reader.onerror = _ => reject(`Error while reading chunk ${i} offset=${offset} due to ${reader.error} `)
                reader.onload = evt => { read += reader.result.byteLength; log(`read chunk of size ${reader.result.byteLength}`) }
                reader.onloadend = _ => loop(resolve, reject, read)
                reader.readAsArrayBuffer(chunk)
            }
            await new Promise(loop)
            log(`<h4>finished to read ${partname}</h4>`)
        } else {
            log(`<h4>no more parts</h4>`)
        }
        part++
    } while (response);
}

async function clearCacheAPI() {
    const keys = await caches.keys();
    for (const key of keys) {
        await caches.delete(key);
    }
    log(`Cache API cleared`)
}
async function clearFSAPI(fs) {
    await new Promise((resolve, reject) => {
        const reader = fs.root.createReader()
        reader.readEntries(entries => {
            const promises = []
            for (const entry of entries) {
                const promise = entry.isDirectory
                    ? new Promise((res, rej) => entry.removeRecursively(res, err => { log(`unable to remove dir ${entry.name}`); res() }))
                    : new Promise((res, rej) => entry.remove(res, err => { log(`unable to remove file ${entry.name}`); res() }))
                promises.push(promise)
            }
            Promise.all(promises).then(resolve).catch(resolve)
        }, error => {
            log(`unable to read FileSystem API root : ${error.toString()}`)
            resolve()
        })
    })
    log(`FileSystem API cleared`)
}

function listFSAPI(fs) {
    return new Promise((resolve, reject) => {
        const reader = fs.root.createReader()
        reader.readEntries(entries => {
            const promises = []
            if (entries.length === 0) log(`File System API is Empty:`)
            for (const entry of entries) {
                const promise = new Promise((res, rej) =>
                    entry.getMetadata(
                        md => { log(`<li> ${entry.fullPath} : ${md.size} bytes  / modified: ${md.modificationTime.toString().replace(/GMT.*/, '')}</li>`); res() },
                        e => { log(`<li>  ${entry.fullPath} error:${e.target.error}</li>`); res() })
                )
                promises.push(promise)
            }
            resolve(Promise.all(promises))
        }, e => {
            log(`unable to read FileSystem API root: ${e.target.error}`)
            resolve()
        })
    })
}

function fetch3x(url) {
    const loop = (resolve, reject, times = 0) => {
        download(url)
            .then(response =>  resolve(response) )
            .catch(e => (times === 3) ? reject(e) : loop(resolve, reject, times + 1))
    }
    return new Promise(loop)
}
function download(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('GET', url)
        xhr.responseType = 'arraybuffer'
        xhr.onload = (evt) => resolve(xhr.response)
        xhr.onerror = evt => reject(evt.target.error)
        xhr.send(null);
    })
}
async function partialfilesfs() {
    const parcel = 'F_PARCEL.geojson'
    const fs = await initfs(10 * 1024 * 1024 * 1024)
    //await clearCacheAPI()
    await clearFSAPI(fs)
    await listFSAPI(fs)

    // caching 
    const partsize = 100000000
    await estimate()
    for (let part=0;part < 10;part++) {
        let cached = 0
        let offset = 0
        let chunk = 0
        const partname = parcel.replace(/\.geojson$/, `${part}.geojson`)
        log(`<u>${partname} processing</u>`)
        do {
            const array = await fetch3x(`https://192.168.1.38:8443/geo/BCJ/FDP/${parcel}?start=${offset}&end=${offset + partsize - 1}`)
            const blob = new Blob([array])
            log(`<li>${partname}[${chunk}] loaded  file </li>`)
            if (blob.size > 0) {
                const file = await create(fs, partname)
                await write(file, offset, blob)
                log(`<li>${partname}[${chunk}] added  ${blob.size} bytes $</li>`)
            }
            chunk++
            offset += blob.size
            cached = blob.size
        } while (cached === partsize);
        log(`<li>${partname} written size = ${offset} bytes $</li>`)
    }
    await estimate()
    await listFSAPI(fs)

}

window.addEventListener('load', _ => {
    initfs().then(fs => listFSAPI(fs)).then(estimate).catch(_ => _)
})
function doit() {
    log('<h1>Starting</h1>')
    initfs()
    .then(clearFSAPI)
    .then (largefile)
    .then(_ => log(`<h1 style="color:green">OK : well done !</h1>`))
    .catch(e => log(`<h1 style="color:red">ERROR ! : ${e.stack || e.toString()}</h1>`))
}
