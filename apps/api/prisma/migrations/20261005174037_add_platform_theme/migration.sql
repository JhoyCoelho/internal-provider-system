-- CreateTable
CREATE TABLE "configuracao_plataforma" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "brand_primary" VARCHAR(7) NOT NULL DEFAULT '#1d4ed8',
    "brand_accent" VARCHAR(7) NOT NULL DEFAULT '#0f766e',
    "page_background" VARCHAR(7) NOT NULL DEFAULT '#f8fafc',
    "surface_background" VARCHAR(7) NOT NULL DEFAULT '#ffffff',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_plataforma_pkey" PRIMARY KEY ("id")
);
