-- CreateEnum
CREATE TYPE "StatusRotaRemocao" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "rotas_remocao" (
    "id" UUID NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "origem" VARCHAR(64) NOT NULL,
    "status" "StatusRotaRemocao" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "distancia_km" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "rotas_remocao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotas_remocao_paradas" (
    "id" UUID NOT NULL,
    "rota_id" UUID NOT NULL,
    "ordem_id" UUID NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rotas_remocao_paradas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rotas_remocao_criado_por_id_created_at_idx" ON "rotas_remocao"("criado_por_id", "created_at");

-- CreateIndex
CREATE INDEX "rotas_remocao_paradas_ordem_id_idx" ON "rotas_remocao_paradas"("ordem_id");

-- CreateIndex
CREATE UNIQUE INDEX "rotas_remocao_paradas_rota_id_ordem_id_key" ON "rotas_remocao_paradas"("rota_id", "ordem_id");

-- CreateIndex
CREATE UNIQUE INDEX "rotas_remocao_paradas_rota_id_sequencia_key" ON "rotas_remocao_paradas"("rota_id", "sequencia");

-- AddForeignKey
ALTER TABLE "rotas_remocao" ADD CONSTRAINT "rotas_remocao_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotas_remocao_paradas" ADD CONSTRAINT "rotas_remocao_paradas_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rotas_remocao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotas_remocao_paradas" ADD CONSTRAINT "rotas_remocao_paradas_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "ordens_remocao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
