-- CreateTable
CREATE TABLE "contacts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" SERIAL NOT NULL,
    "contactId" INTEGER NOT NULL,
    "label" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "channel_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" SERIAL NOT NULL,
    "contactId" INTEGER NOT NULL,
    "channelTypeId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addresses_contactId_idx" ON "addresses"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_types_name_key" ON "channel_types"("name");

-- CreateIndex
CREATE INDEX "channels_contactId_idx" ON "channels"("contactId");

-- CreateIndex
CREATE INDEX "channels_channelTypeId_idx" ON "channels"("channelTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "channels_contactId_channelTypeId_value_key" ON "channels"("contactId", "channelTypeId", "value");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_channelTypeId_fkey" FOREIGN KEY ("channelTypeId") REFERENCES "channel_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;