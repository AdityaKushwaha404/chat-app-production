# Chat App

A real-time chat application with a TypeScript Node.js backend and an Expo React Native frontend. This repository contains the backend API, socket server, and mobile frontend used for messaging, groups, and push notifications.

**Tech stack**
- Backend: Node.js, TypeScript, Express, Socket.IO, MongoDB
- Frontend: React Native (Expo), TypeScript
- Dev tooling: ESLint, TypeScript, Metro, npm/yarn

**Key features**
- Real-time messaging using Socket.IO
- Conversations and group chats
- User authentication and authorization
- Push notifications and keep-alive
- Basic file/image upload support

**Repository layout**
- `backend/` — API server, socket handling, controllers, models, and backend assets
- `frontend/` — Expo React Native app, components, screens, and services
- `backend_assets/`, `frontend_assets/` — shared types and constants
- `scripts/` — developer utilities

**Getting started**

Prerequisites
- Node.js (16+ recommended)
- npm or yarn
- MongoDB instance (local or hosted)

Run the backend

1. Open a terminal and install dependencies:

```bash
cd backend
npm install
```

2. Create a `.env` file in `backend/` (copy from `.env.example` if present) and set the following environment variables:

- `MONGO_URI` — MongoDB connection string
- `PORT` — Backend server port (default: 3000)
- `JWT_SECRET` — Secret for signing JWTs
- Any push notification keys or provider settings used by `push.ts`/`notifications.ts`

3. Start the backend (development):

```bash
npm run dev
# or
npm start
```

Run the frontend (Expo)

1. Open a terminal and install dependencies:

```bash
cd frontend
npm install
```

2. Start the Expo dev server:

```bash
expo start
```

-3. Open the app on a simulator or a physical device using the Expo Go app.

Download a prebuilt Expo app

- If you have a prebuilt Expo app, you can download and run it directly from the Expo build URL:

- [Download the latest build](https://expo.dev/accounts/adityakushwaha404/projects/frontend/builds/66b38cc6-819e-4a30-898c-1da51c470002)

	Open the link in a browser or scan it from a device to install the build via Expo Go or the native installer provided by the build.

Testing & smoke tests
- The backend contains test scripts in `backend/` like `test-smoke.mjs` and socket client scripts (`test-socket-client.mjs`). Run them with `node` (after building or using `ts-node`) to validate socket behavior.

Deployment notes
- The backend can be deployed as a Node service (Heroku, DigitalOcean, Render, etc.). Ensure environment variables and a persistent MongoDB instance are provided.
- The frontend can be built via Expo's build pipelines or EAS for App Store / Play Store deployment.

Contributing
- Fork the repo and open a PR with a clear description of your change.
- Add tests for new functionality where appropriate.

License
- This project is provided under the MIT License. Update or replace with your preferred license.

Contact
- For questions or help, open an issue or contact the maintainers through the repository.

---

Files & entry points to inspect
- `backend/index.ts` — backend server entry
- `backend/socket.ts` and `socket/` — socket handling
- `frontend/app.json` and `frontend/app/index.tsx` — Expo app entry

Thank you for checking out the project — feel free to open issues or contribute!

Screenshots
- The project screenshots are available in the `readme_images/` folder. Preview or embed them from the links below:

![Screenshot 1](readme_images/WhatsApp%20Image%202026-01-14%20at%2021.12.02.jpeg)

![Screenshot 2](readme_images/WhatsApp%20Image%202026-01-14%20at%2021.12.03.jpeg)

![Screenshot 3](readme_images/WhatsApp%20Image%202026-01-14%20at%2021.12.04.jpeg)

![Screenshot 4](readme_images/WhatsApp%20Image%202026-01-14%20at%2021.12.05%20%281%29.jpeg)

![Screenshot 5](readme_images/WhatsApp%20Image%202026-01-14%20at%2021.12.05.jpeg)

![Screenshot 6](readme_images/WhatsApp%20Image%202026-01-14%20at%2021.12.06%20%281%29.jpeg)

![Screenshot 7](readme_images/WhatsApp%20Image%202026-01-14%20at%2021.12.06%20%282%29.jpeg)

![Screenshot 8](readme_images/WhatsApp%20Image%202026-01-14%20at%2021.12.06.jpeg)
