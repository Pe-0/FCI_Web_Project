# MediLine

MediLine is a responsive medical equipment marketplace built with plain HTML, CSS, JavaScript, and a Node.js + SQLite backend.

## Features

- English storefront for medical equipment
- Category browsing and search
- Product details modal with rich specs
- Shopping cart with quantity controls
- Register, log in, and account history
- Persistent SQLite data for users, products, cart, and orders

## Requirements

- Node.js `22.5.0` or newer

The app uses the built-in `node:sqlite` module, so no extra npm dependencies are required.

## Run It

```powershell
cd D:\study\programming
npm start
```

Then open:

```text
http://localhost:3000/
```

> Important: do not open `Home.html` directly or use the VS Code **Live Server** button. Those options only serve the HTML files and cannot provide the `/api/...` routes used for products, login, cart, and the database.

If PowerShell says that `node` or `npm` is not recognized, install Node.js `22.5.0` or newer, reopen PowerShell, and run the commands above again.

## Optional Configuration

You can override the port or database location with environment variables:

```powershell
$env:PORT = "3001"
$env:DB_PATH = "D:\study\programming\data\mediline.db"
npm start
```

## Project Files

- `Home.html` - landing page
- `Categories.html` - category browser
- `Cart.html` - cart page
- `Login.html` - authentication page
- `Setting.html` - account page
- `server.js` - HTTP server and SQLite API
- `script.js` - frontend interactions
- `style.css` - site styling
