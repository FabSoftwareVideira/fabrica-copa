const swaggerJSDoc = require("swagger-jsdoc");

function createSwaggerSpec(apiBaseServerUrl) {
    const swaggerOptions = {
        definition: {
            openapi: "3.0.3",
            info: {
                title: "Album Copa 2026 API",
                version: "1.0.0",
                description: "Documentacao da API do Album Copa 2026",
            },
            servers: [{ url: apiBaseServerUrl }],
            tags: [
                { name: "Health", description: "Status do backend" },
                { name: "Auth", description: "Autenticacao e sessao" },
                { name: "Album", description: "Estado do album e pacotes" },
                { name: "Promo", description: "Resgate de codigos e cupons" },
                { name: "Admin", description: "Ferramentas administrativas" },
                { name: "Trade", description: "Troca de figurinhas" },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT",
                    },
                },
                schemas: {
                    ApiError: {
                        type: "object",
                        properties: {
                            error: { type: "string" },
                            code: { type: "string" },
                            detail: { type: "string" },
                        },
                    },
                },
            },
            paths: {
                "/health": {
                    get: {
                        tags: ["Health"],
                        summary: "Health check",
                        responses: {
                            200: {
                                description: "Servico ativo",
                            },
                        },
                    },
                },
                "/auth/google": {
                    post: {
                        tags: ["Auth"],
                        summary: "Login com Google OAuth",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["idToken"],
                                        properties: {
                                            idToken: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Autenticado com sucesso" },
                            401: { description: "Falha na autenticacao" },
                        },
                    },
                },
                "/auth/refresh": {
                    post: {
                        tags: ["Auth"],
                        summary: "Renova token de acesso",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["refreshToken"],
                                        properties: {
                                            refreshToken: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Token renovado" },
                            401: { description: "Refresh token invalido" },
                        },
                    },
                },
                "/auth/logout": {
                    post: {
                        tags: ["Auth"],
                        summary: "Efetua logout",
                        requestBody: {
                            required: false,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            refreshToken: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            200: { description: "Logout concluido" },
                        },
                    },
                },
                "/auth/me": {
                    get: {
                        tags: ["Auth"],
                        summary: "Retorna usuario autenticado",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Usuario atual" },
                            401: { description: "Nao autenticado" },
                        },
                    },
                },
                "/stickers/catalog": {
                    get: {
                        tags: ["Album"],
                        summary: "Lista catalogo de figurinhas",
                        responses: {
                            200: { description: "Catalogo retornado" },
                        },
                    },
                },
                "/album/state": {
                    get: {
                        tags: ["Album"],
                        summary: "Busca estado do album",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Estado do album" },
                        },
                    },
                    put: {
                        tags: ["Album"],
                        summary: "Atualiza estado do album",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Estado atualizado" },
                        },
                    },
                },
                "/packs/open": {
                    post: {
                        tags: ["Album"],
                        summary: "Abre um pacotinho",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Pacote aberto" },
                            400: { description: "Limite diario atingido" },
                        },
                    },
                },
                "/packs/history": {
                    get: {
                        tags: ["Album"],
                        summary: "Historico de pacotinhos",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Historico retornado" },
                        },
                    },
                },
                "/promo/redeem": {
                    post: {
                        tags: ["Promo"],
                        summary: "Resgata codigo promocional ou cupom",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Codigo resgatado" },
                            400: { description: "Codigo invalido" },
                        },
                    },
                },
                "/coupons/targets": {
                    get: {
                        tags: ["Promo"],
                        summary: "Lista usuarios-alvo para gerar cupom",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Usuarios retornados" },
                        },
                    },
                },
                "/coupons/generate": {
                    post: {
                        tags: ["Promo"],
                        summary: "Gera cupom de pacotes",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            201: { description: "Cupom gerado" },
                        },
                    },
                },
                "/admin/users": {
                    get: {
                        tags: ["Admin"],
                        summary: "Lista usuarios (admin)",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Usuarios retornados" },
                        },
                    },
                },
                "/admin/coupons": {
                    get: {
                        tags: ["Admin"],
                        summary: "Lista todos os cupons (admin)",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Cupons retornados" },
                        },
                    },
                },
                "/admin/coupons/{id}": {
                    delete: {
                        tags: ["Admin"],
                        summary: "Exclui cupom por id (admin)",
                        security: [{ bearerAuth: [] }],
                        parameters: [
                            {
                                name: "id",
                                in: "path",
                                required: true,
                                schema: { type: "integer" },
                            },
                        ],
                        responses: {
                            200: { description: "Cupom excluido" },
                            404: { description: "Cupom nao encontrado" },
                        },
                    },
                },
                "/trade/users": {
                    get: {
                        tags: ["Trade"],
                        summary: "Lista usuarios para trocas",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Usuarios retornados" },
                        },
                    },
                },
                "/trade/offers": {
                    get: {
                        tags: ["Trade"],
                        summary: "Lista ofertas de troca",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            200: { description: "Ofertas retornadas" },
                        },
                    },
                    post: {
                        tags: ["Trade"],
                        summary: "Cria oferta de troca",
                        security: [{ bearerAuth: [] }],
                        responses: {
                            201: { description: "Oferta criada" },
                        },
                    },
                },
            },
        },
        apis: [],
    };

    return swaggerJSDoc(swaggerOptions);
}

module.exports = { createSwaggerSpec };
