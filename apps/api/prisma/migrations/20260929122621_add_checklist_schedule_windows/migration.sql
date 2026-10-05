/*
  Warnings:

  - A unique constraint covering the columns `[usuario_id,categoria,janela,data_agenda]` on the table `checklists` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "JanelaChecklist" AS ENUM ('INICIO_EXPEDIENTE', 'FIM_EXPEDIENTE');

-- AlterTable
ALTER TABLE "checklists" ADD COLUMN     "data_agenda" DATE,
ADD COLUMN     "janela" "JanelaChecklist",
ALTER COLUMN "data_preenchimento" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "checklists_usuario_id_categoria_janela_data_agenda_key" ON "checklists"("usuario_id", "categoria", "janela", "data_agenda");
