#!/usr/bin/env node
import { parseArgs } from "node:util";

import { fail } from "./helpers.js";
import { addModule, disableModule, enableModule, listModules, removeModule, validateModules } from "./module.js";

function printHelp(): void {
	console.log(`Uso: alxarafe <comando> [opciones]

Comandos de módulos:
  module list                        Lista packages y módulos con su estado
  module validate [nombre]           Valida manifiestos y el grafo de dependencias
  module enable <nombre>             Activa un módulo (config/modules.json)
  module disable <nombre>            Desactiva un módulo
  module add <nombre> --from <url|ruta> [--no-enable]
                                     Instala un módulo localmente (clone/copia en
                                     modules/, sin trackear en git), enlaza su
                                     fragment Prisma, lo activa por defecto y lo
                                     compila
  module remove <nombre> [--drop-schema]
                                     Desinstala un módulo y opcionalmente borra su
                                     esquema en la base de datos

Opciones globales:
  -h, --help                         Muestra esta ayuda`);
}

function requireName(action: string, name: string | undefined): void {
	if (!name) fail(`El comando 'module ${action}' necesita un nombre.`);
}

function main(): void {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			from: { type: "string" },
			"no-enable": { type: "boolean", default: false },
			"drop-schema": { type: "boolean", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
		allowPositionals: true,
	});

	if (values.help) {
		printHelp();
		return;
	}

	const [cmd, ...rest] = positionals;
	if (!cmd) {
		printHelp();
		return;
	}
	if (cmd !== "module") {
		console.error(`[error] Comando desconocido: '${cmd}'`);
		printHelp();
		process.exitCode = 1;
		return;
	}

	const action = rest[0];
	const name = rest[1];

	try {
		switch (action) {
			case "list":
				listModules();
				break;
			case "validate":
				validateModules(name);
				break;
			case "enable":
				requireName(action, name);
				enableModule(name);
				break;
			case "disable":
				requireName(action, name);
				disableModule(name);
				break;
			case "add":
				requireName(action, name);
				addModule(name, { from: values.from ?? "", enable: !values["no-enable"] });
				break;
			case "remove":
				requireName(action, name);
				removeModule(name, { dropSchema: values["drop-schema"] });
				break;
			default:
				console.error(`[error] Comando desconocido: 'module ${action ?? ""}'`);
				printHelp();
				process.exitCode = 1;
		}
	} catch (err) {
		console.error(`[error] ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
	}
}

main();
