// Origem definida pelo operador, nunca por headers ou parâmetros do usuário.
export const backendOrigin = new URL(process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000").origin;
