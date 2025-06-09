@echo off
echo Starting Server and Client...

REM Start the Node.js server
echo Starting server...
start "Server" cmd /k "cd server && set JWT_SECRET=dev_jwt_secret_key_for_development && set NODE_ENV=development && node server.js"

REM Start the React client using Parcel (run from root, specify full path)
echo Starting client...
start "Client" cmd /k "npx parcel client/public/index.html"

echo Both processes started in separate windows. 