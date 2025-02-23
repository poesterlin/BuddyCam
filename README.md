# BuddyCam: Fostering Meaningful Connections Through Shared Experiences

BuddyCam is a web application designed to facilitate meaningful connections and enhance shared experiences among users. The platform provides a unique approach to social interaction by enabling simultaneous capture of moments from multiple perspectives.

## Key Features

- **Dual-Perspective Capture:** Enables users to capture photos and videos from two viewpoints concurrently, fostering collaborative memory creation.
- **Friend Request System:** Facilitates the establishment of connections and the expansion of user networks.
- **User Profiles:** Provides a customizable space for users to showcase their personality and interests.
- **Notification System:** Delivers timely updates on friend requests, messages, and other relevant events.
- **Responsive Design:** Ensures optimal user experience across a variety of devices.

## Technologies Used

- **[SvelteKit](https://kit.svelte.dev/):** A framework for building web applications with a focus on performance and developer experience.
- **[SvelteKit SSE](https://github.com/razshare/sveltekit-sse):** A SvelteKit plugin for server-sent events (SSE) support.
- **[Tailwind CSS](https://tailwindcss.com/):** A utility-first CSS framework for rapid UI development.
- **[Bun.js](https://bun.sh):** A JavaScript runtime environment for server-side execution.
- **[Drizzle ORM](https://https://orm.drizzle.team/):** A lightweight and efficient object-relational mapping library
- **[PostgreSQL](https://www.postgresql.org/):** A robust and scalable relational database management system.
- **[Minio](https://min.io/):** An open-source object storage server compatible with Amazon S3 APIs.

## Getting Started

1.  **Install dependencies:**

    ```bash
    bun install
    ```

2.  **Configure environment variables:**

    - Create a `.env` file in the root directory.
    - Define the necessary environment variables (replace with your actual values):

    ```
    DATABASE_URL="postgres://user:password@host:port/db-name"

    MINIO_URL=
    MINIO_KEY=
    MINIO_SECRET=
    MINIO_BUCKET=
    MINIO_PORT=
    ```

3.  **Start the development server:**

    ```bash
    bun run dev
    ```

    This command will launch the development server and open the application in your web browser.

## Contributing

Contributions to BuddyCam are welcome. Please adhere to the following guidelines:

1.  Fork the repository.
2.  Create a dedicated branch for your proposed changes.
3.  Implement your modifications and commit them with descriptive messages.
4.  Submit a pull request for review.

## License

This project is licensed under the [MIT License](LICENSE).
