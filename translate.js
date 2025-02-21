//
// 
// 
var fs = require('fs');
var path = require('path');
var pako = require('pako');
var xml2json = require('xml2json');
var htmlEntities = require('html-entities');


// translate "text" to "lng" / destination language
// return "text" if no translations available
function translate(text, lng) {
    var translation = languages.filter(language => language.en === text)
    if (translation && translation.length == 1) {
        const t = translation[0][lng]
        if (t !== undefined) {
            return t
        }
    }

    return text;
}

// recursively traverse all javascript object properties and translate the "value" property
function traverse(object, lng) {
    if (object !== null && typeof object == "object") {
        Object.keys(object).forEach((key) => {

            if (key === 'value') {
                object[key] = translate(object[key], lng);
            } else {
                traverse(object[key], lng)
            }

        });
    }
}
// translate the "value" attribute of XML element
function translateValue(xml, lng) {
    var object = JSON.parse(xml2json.toJson(xml)) // convert XML to JSON and than to javascript object

    traverse(object, lng)

    return xml2json.toXml(object);
}

// main
if(process.argv.length <= 2) {
    throw new Error("target language is not specified")
}

const languages = JSON.parse(fs.readFileSync(path.join(__dirname, 'languages.json')))
process.argv.slice(2).forEach(destLanguage => {

    const libraryFilename = "genogram_" + destLanguage + ".xml"

    console.log("create library for language \"" + destLanguage + "\": " + libraryFilename)

    const genogram_xml = fs.readFileSync(path.join(__dirname, 'genogram.xml'))
    const genogram_json = genogram_xml.toString().replace('<mxlibrary>', '').replace('</mxlibrary>', '')
    const mxlibrary = JSON.parse(genogram_json)

    mxlibrary.forEach(element => {
        let xml;
        if(element.xml.startsWith('&')) {
            xml = htmlEntities.decode(element.xml)
        } else {
            xml = decodeURIComponent(Buffer.from(pako.inflateRaw(Buffer.from(element.xml, 'base64'))).toString('ascii'))
        }

        if( destLanguage === 'compress') {
            element.xml = Buffer.from(pako.deflateRaw(encodeURIComponent(xml))).toString('base64')
        } else { // translate
            const translated_xml = translateValue(xml, destLanguage)
            element.xml = Buffer.from(pako.deflateRaw(encodeURIComponent(translated_xml))).toString('base64')
            element.title = translate(element.title, destLanguage)
        }

    })

    fs.writeFileSync(libraryFilename, ["<mxlibrary>", JSON.stringify(mxlibrary), "</mxlibrary>"].join(""));

})

console.log("done")