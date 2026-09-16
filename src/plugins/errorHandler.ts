import fp from "fastify-plugin";
import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors";

interface JsonErrorBody {
  error: {
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

function send(reply: FastifyReply, statusCode: number, message: string, details?: unknown) {
  const body: JsonErrorBody = { error: { message, statusCode } };
  if (details !== undefined) body.error.details = details;
  return reply.code(statusCode).send(body);
}

export default fp(async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler(
    (error: FastifyError | Error, _request: FastifyRequest, reply: FastifyReply) => {
      // Domain-level errors thrown by services (404, 409, 401, 400, ...)
      if (error instanceof AppError) {
        return send(reply, error.statusCode, error.message);
      }

      // zod validation errors (thrown manually in route handlers)
      if (error instanceof ZodError) {
        return send(reply, 400, "Validation failed", error.flatten());
      }

      // Fastify's own JSON-schema validation errors
      if ((error as FastifyError).validation) {
        return send(reply, 400, error.message, (error as FastifyError).validation);
      }

      // Prisma known request errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "field";
          return send(reply, 409, `A record with this ${target} already exists`);
        }
        if (error.code === "P2025") {
          return send(reply, 404, "Resource not found");
        }
      }

      const statusCode = (error as FastifyError).statusCode ?? 500;

      if (statusCode >= 500) {
        fastify.log.error(error);
      }

      return send(reply, statusCode, statusCode >= 500 ? "Internal server error" : error.message);
    }
  );

  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    return send(reply, 404, `Route ${request.method} ${request.url} not found`);
  });
});
