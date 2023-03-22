const { app, BrowserWindow } = require('electron');
const http = require('http');
const { URL } = require('url');
const querystring = require('querystring');
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', function () {
  createWindow();

  const escpos = require('escpos')
  escpos.USB = require('escpos-usb')
  // const vid = 0x0483, pid = 0x5743
  var bodyParser = require('body-parser')
  var app = require('express')()
  var http = require('http').Server(app)
  var fs = require('fs')
  var cors = require('cors')
  app.use(cors())
  app.use(bodyParser.json())

  const port = 4000;
  const statusArr = {
    SUCCESS: 1,
    FAILED: 0
  }

  let devices, cashierDevice, kitchenDevice, cashierPrinter, kitchenPrinter;

  app.get('/printer-list', (req, res) => {
    devices = escpos.USB.findPrinter()
    if(devices?.length) {
      let config;
      if(fs.existsSync('config.json')) {
        config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
      } else {
        config = {
          cashier_printer: 0,
          kitchen_printer: 0
        }
        fs.writeFileSync('config.json', JSON.stringify(config));
      }
      cashierDevice = new escpos.USB(devices[config.cashier_printer]);
      cashierPrinter = new escpos.Printer(cashierDevice);
      kitchenDevice = new escpos.USB(devices[config.kitchen_printer]);
      kitchenPrinter = new escpos.Printer(kitchenDevice);
      res.json({
        status: statusArr.SUCCESS,
        devices,
        cashierPrinter: config.cashier_printer,
        kitchenPrinter: config.kitchen_printer
      })
    } else {
      res.json({
        status: statusArr.FAILED,
        msg: 'no printers available'
      })
    }
  })
  app.post('/select-printer', (req, res) => {
    try {
      const { index, type } = req.body;
      if(type === 'cashier_printer') {
        cashierDevice = new escpos.USB(devices[index]);
        cashierPrinter = new escpos.Printer(cashierDevice)
        let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        config.cashier_printer = index;
        fs.writeFileSync('config.json', JSON.stringify(config))
      } else {
        kitchenDevice = new escpos.USB(devices[index]);
        kitchenPrinter = new escpos.Printer(kitchenDevice)
        let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        config.kitchen_printer = index;
        fs.writeFileSync('config.json', JSON.stringify(config))
      }
      res.json({
        status: statusArr.SUCCESS
      })
    } catch (err) {
      res.json({
        status: statusArr.FAILED,
        msg: 'Something went wrong'
      })
    }
  })
  app.post('/print', async (req, res) => {
    try {
      const { data, printer } = req.body;
      await print(data, printer);
      res.json({ 
        status: statusArr.SUCCESS,
        msg: 'Success' 
      })
    } catch (err) {
      console.log(err)
      let msg = err.msg || 'Something went wrong'
      res.json({
        status: statusArr.FAILED,
        msg
      })
    }
  });

  http.listen(port, () => {
    console.log(`Printer: http://localhost:${port}`);
  });

  const print = (data, type) => {
    return new Promise((resolve, reject) => {
      if(type === 'cashier_printer') {
        // these commands should be fetched from NestJS API
        const commands = new Uint8Array([
          0x1b, 0x40, // initialize printer
          0x1b, 0x61, 0x01, // center align
          0x1b, 0x21, 0x08, // double height, double width
          0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64, 0x21, // "Hello, World!" in ASCII
          0x0a, // line feed
          0x1d, 0x56, 0x01, // cut paper
        ]);
        
        cashierDevice.open(() => {
          cashierDevice.write(commands);
          cashierDevice.close();
          resolve(true);
        })
        console.log(`print ${data} to cashier printer ${cashierPrinter}`)
      } else if (type === 'kitchen_printer') {
        // these commands should be fetched from NestJS API
        const commands = new Uint8Array([
          0x1b, 0x40, // initialize printer
          0x1b, 0x61, 0x01, // center align
          0x1b, 0x21, 0x08, // double height, double width
          0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64, 0x21, // "Hello, World!" in ASCII
          0x0a, // line feed
          0x1d, 0x56, 0x01, // cut paper
        ]);
        
        kitchenDevice.open(() => {
          kitchenDevice.write(commands);
          kitchenDevice.close();
          resolve(true);
        })
        console.log(`print ${data} to kitchen printer ${kitchenPrinter}`)
      } else {
        console.log('unknown printer')
        reject({
          msg: 'unknown printer'
        });
      }
    })
    // device.open(function () {
    //   printer
    //     .font('a')
    //     .align('ct')
    //     .style('bu')
    //     .size(1, 1)
    //     .text(text)
    //     .cut()
    //     .close();
    // });
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
