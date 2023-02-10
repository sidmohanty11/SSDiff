// go to the webiste1 take ss
// go to website2 take ss
// match the ss with pixel match and sho the difference 
// ISSUES : 
// page size needs to be same
// Position of pixels
const puppeteer = require("puppeteer");
const pixelmatch = require('pixelmatch');
const fs = require('fs');
const PNG = require('pngjs').PNG
const Links = require('./links.json');
const { URL } = require("url");

class ScreenshotDiff{
    constructor(url_1, url_2, pathnames ,browserConfig, debug = false){
        this.url_1 = url_1
        this.url_2 = url_2
        this.pathnames = pathnames
        this.browser = null
        this.debug = debug
        this.browserConfig = browserConfig
        // TODO: make the file naming dynamic based on hostnames
        this.screenshotsFolder = __dirname + '/screenshots'
        this.localhostScreenshots = this.screenshotsFolder + '/localhost';
        this.productionScreenshots =this.screenshotsFolder + '/production';
        this.diffScreenshots = this.screenshotsFolder + '/diff';

        if(!fs.existsSync(this.screenshotsFolder)){
            fs.mkdirSync(this.screenshotsFolder, { recursive: true });
            this.log("Created screenshot dir")
        }
        if (!fs.existsSync(this.localhostScreenshots)){
            fs.mkdirSync(this.localhostScreenshots, { recursive: true });
            this.log("Created folder for localhost ss")
        }
        if (!fs.existsSync(this.productionScreenshots)){
            fs.mkdirSync(this.productionScreenshots, { recursive: true });
            this.log("Created folder for production ss")
        }
        if (!fs.existsSync(this.diffScreenshots)){
            fs.mkdirSync(this.diffScreenshots, { recursive: true });
            this.log("Created folder for diff ss")
        }
    }
    log(text){
        if(this.debug){
            console.log(text)
        }
    }
    async puppeteer_browser_open(){
        if(!this.browser){
            this.browser = await puppeteer.launch(this.browserConfig)
        }
    }
    async puppeteer_browser_close(){
        if(this.browser){
            await this.browser.close()
            // setting this as null so we dont get closed instance the next time
            this.browser = null
        }
    }
    getFileName(url){
        const parsedURL = new URL(url)
        return parsedURL.pathname.split('/')[3]
    }
    getFileLocation(url, fileName){
        const parsedURL = new URL(url)
        // TODO: make this dynamic based on site name as config
        const filePath = (parsedURL.hostname.indexOf('localhost') !== -1 || parsedURL.hostname.indexOf('site-qwik') !== -1) ? this.localhostScreenshots : this.productionScreenshots
        return filePath + '/' + fileName
    }
    async screenshot(url, fileName){
       const page = await this.browser.newPage();
       this.log('New Page in browser opened')
       console.log(url)
       await page.goto(url, {
            waitUntil:"networkidle0",
            timeout : 0
       })
       this.log('URL opened on page')
       // fileLocation ->  localhost_developers
       const fileLocation = this.getFileLocation(url, fileName)
       await page.screenshot({path : fileLocation,type:"png"})
       this.log(`SS of the page saved at ${fileLocation}`)
       await page.close()
       this.log('Page closed')
       return fileLocation
    }
    async compare(compareObj){
        const {url_1, url_2, fileName} = compareObj
        const screenshots = await Promise.all([this.screenshot(url_1, fileName), this.screenshot(url_2, fileName)])
        const image_1 = PNG.sync.read(fs.readFileSync(screenshots[0]));
        const image_2 = PNG.sync.read(fs.readFileSync(screenshots[1]));
        const {height, width} = image_1
        const diff = new PNG({ width, height });
        pixelmatch(image_1.data, image_2.data, diff.data, width, height, { threshold: 0.7, includeAA: true });
        fs.writeFileSync(__dirname + `/screenshots/diff/${fileName}`, PNG.sync.write(diff));
    }
    async result(){
        await this.puppeteer_browser_open()
        this.log('Browser opened')
        const urls = this.pathnames.map((pathname) => {
            return {
                url_1 : this.url_1 + pathname,
                url_2 : this.url_2 + pathname,
                fileName : this.getFileName(this.url_1+pathname) 
            }
        })
        const promises = urls.map((compareObj) => this.compare(compareObj))
        await Promise.all(promises)
        await this.puppeteer_browser_close()
        this.log('Browser closed')
    }
}

const localhost = 'http://site-qwik.vercel.app'
// const localhost = 'http://localhost:5173'
const production = 'https://www.builder.io'

const getLinks = (links, result) => {
    links.forEach((link) => {
        if(link.subLinks){
            getLinks(link.subLinks, result)
        }else{
            try{
                const url = new URL(link.link)
                result.push(url.pathname)
            }catch(e){
                result.push(link.link)
            }
        }
    })
    return result
}

const helper = async () => {
    const pathnames = getLinks(Links, []).slice(0, 5)
    const browserConfig = {
        defaultViewport: {
          width: 1294,
          height: 1280,
        },
    }
    const ssDiff = new ScreenshotDiff(localhost, production, pathnames, browserConfig, true)
    await ssDiff.result()
}

helper()  