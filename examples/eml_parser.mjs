import fs from "node:fs"
import * as emlParser from "../dist/index.mjs"

// emlParser.setCharsetConvertHandler((data, charset) => {
//     return "ffffffffffffffff"
// })

// 程序开始

var argv = process.argv
if (argv.length < 3) {
    console.log("USAGE: " + argv[0] + " " + argv[1] + "eml_fn [ eml_fn2 [ ... ] ]")
    console.log("examples")
    console.log(argv[0], argv[1], "some-path.eml")
    process.exit(1)
}

function do_parse_one_eml(fn) {
    var options = {}
    options.debug = true
    try {
        options.emlData = fs.readFileSync(fn)
    }
    catch {
        console.error("ERR load data from", fn)
        process.exit(1)
    }

    var parser = new emlParser.emlParser(options)
    var i, ms

    console.log("\n### 邮件头\n")
    console.log("Date: ", parser.dateUnix, parser.date)
    console.log("Subject: ", parser.subject)
    console.log("From: ", parser.from)
    console.log("Sender: ", parser.sender)
    console.log("To: ", parser.to)
    console.log("Cc: ", parser.cc)
    console.log("Bcc: ", parser.bcc)
    console.log("Bcc: ", parser.bcc)
    console.log("MessageId: ", parser.messageId)
    console.log("References: ", parser.references)
    console.log("ReplyTo: ", parser.replyTo)
    console.log("DispositionNotificationTo: ", parser.dispositionNotificationTo)
    console.log("First Header Mime Line: ", parser.topNode.headers[0])
    console.log("X-Mailer Mime Line: ", parser.getFirstHeaderLine("X-Mailer"))

    console.log("\n### 优选可读文本\n")
    ms = parser.alternativeShowNodes
    i = 0
    ms.forEach(n => {
        i++
        console.log("No:", i)
        console.log("Type:", n.contentType)
        console.log("Content:", n.textContent.substring(0, 80), "......")
        console.log("Charset: ", n.charset)
        console.log("Encoding: ", n.encoding)
    })

    console.log("\n### 附件\n")
    ms = parser.attachmentNodes
    i = 0
    ms.forEach(n => {
        i++
        console.log("No:", i)
        console.log("Type:", n.contentType)
        console.log("isInline:", n.isInline)
        console.log("isTnef:", n.isTnef)
        console.log("ContentId: ", n.contentId)
        console.log("ContentBuffer:", n.getDecodedBuffer().subarray(0, 100), "......")
        console.log("headerStartPos:", n.headerStartPos)
        console.log("headerLength:", n.headerLength)
        console.log("bodyStartPos: ", n.bodyStartPos)
        console.log("bodyLength: ", n.bodyLength)
        console.log("Disposition: ", n.disposition)
        console.log("Encoding: ", n.encoding)
        console.log("Filename: ", n.filename)
        console.log("Name: ", n.name)
    })
}

// 测试开始
for (var i = 2; i < argv.length; i++) {
    do_parse_one_eml(argv[i])
}
console.log('\nTEST OVER')