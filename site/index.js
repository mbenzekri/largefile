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
function write(fileEntry,offset, blob) {
    return new Promise((resolve, reject) => {
        fileEntry.createWriter(
            fileWriter => {
                fileWriter.onwriteend = _ => resolve(blob.size)
                fileWriter.onerror = e => reject(e.message || e.name)
                if(offset === 0) fileWriter.truncate(offset)
                fileWriter.seek(offset)
                fileWriter.write(blob)
            },
            e => reject(e.message || e.name)
        );
    })
}

function create (fs,filename) {
    return new Promise((resolve, reject) => {
        fs.root.getFile(filename, { create: true },
            fileEntry => resolve(fileEntry),
            e => reject(e.message || e.name)
        )
    })
}
function log(str) {
    const log = document.body
    const div = document.createElement('div')
    div.innerHTML = str
    log.appendChild(div)

}

async function largefile() {
    const start = Date.now()
    const fs = await initfs(10*1024*1024*1024)
    const file = await create(fs,"largefile.dat")
    const array = new Uint8Array(50*1024*1024)
    let size = 0
    for (let i = 0; i < 100; i++) {
        array.fill(i)
        const written = await write(file,size,new Blob([array]))
        size+=written
        log(`chunk ${i}: written = ${size} in ${Date.now() - start} msec`)
    }
}

window.addEventListener('load', _ => {
    log('<h1>Starting</h1>')
    largefile()
    .then(_ => log(`<h1 style="color:green">OK : well done !</h1>`))
    .catch(e => log(`<h1 style="color:red">ERROR ! : ${e.stack}</h1>`))
})