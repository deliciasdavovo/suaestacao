import { useState, useEffect, useRef } from "react";

/* ---------- tokens ---------- */
const T = {
  paper: "#EDEAE2",
  paper2: "#E4E0D5",
  ink: "#221E1A",
  muted: "#8C8573",
  line: "#C9C2B4",
  accent: "#35314A",
  accentSoft: "#4A4560",
  good: "#3E6B4F",
  bad: "#9C4A3C",
};

const SYSTEM_PROMPT = `Você é uma consultora especialista em colorimetria pessoal (análise de coloração, sistema das 4 estações com 12 subtons: Primavera Clara, Primavera Quente, Primavera Brilhante, Verão Claro, Verão Frio, Verão Suave, Outono Suave, Outono Quente, Outono Profundo, Inverno Profundo, Inverno Frio, Inverno Brilhante).
Analise a foto do rosto enviada (tom de pele, subtom, cor dos olhos, cor do cabelo, nível de contraste) e classifique a pessoa em UM desses 12 subtons.
Responda SOMENTE com um JSON válido, sem markdown, sem texto antes ou depois, seguindo exatamente este formato:
{
  "estacao": "Primavera" | "Verão" | "Outono" | "Inverno",
  "subtom": "nome completo do subtom, ex: Outono Quente",
  "temperatura": "quente" | "fria" | "neutra-quente" | "neutra-fria",
  "contraste": "alto" | "médio" | "baixo",
  "resumo": "2 a 3 frases em português explicando o raciocínio com base no que é visível na foto",
  "paleta": [ {"hex": "#RRGGBB", "nome": "nome da cor em português"} — exatamente 14 itens, cores que valorizam essa coloração ],
  "evitar": [ {"hex": "#RRGGBB", "nome": "nome da cor em português"} — exatamente 7 itens, cores que tendem a brigar com essa coloração ]
}`;

const USER_PROMPT =
  "Analise esta foto e retorne o JSON da coloração pessoal, seguindo exatamente o schema do system prompt.";

const PALETTE_LEVELS = ["profundo", "escuro", "médio", "claro", "suave"];
const PRIMAVERA_QUENTE_FAMILIES = [
  "Rosa-framboesa",
  "Roxo",
  "Violeta",
  "Azul-royal",
  "Azul-petróleo",
  "Azul-piscina",
  "Turquesa",
  "Oliva",
  "Verde-folha",
  "Verde-esmeralda",
  "Cinza quente",
  "Marrom",
  "Âmbar",
  "Laranja queimado",
  "Terracota",
  "Vinho",
  "Vermelho",
  "Vermelho-coral",
  "Mostarda",
  "Dourado",
];
const OUTONO_QUENTE_FAMILIES = [
  "Oliva",
  "Verde",
  "Verde-azulado",
  "Petróleo",
  "Turquesa",
  "Ameixa",
  "Magenta",
  "Vinho",
  "Vermelho",
  "Rosa queimado",
  "Rubi",
  "Vermelho-alaranjado",
  "Laranja",
  "Terracota",
  "Marrom rosado",
  "Cáqui",
  "Taupe quente",
  "Mostarda",
  "Âmbar",
  "Caramelo",
];

// mesma cartela do paletteFromGrid, só que descrita família a família
// (cada entrada é [nome, [do mais profundo ao mais suave]).
// O terceiro item de cada família é o nível premium — o tom que a cartela marca
// com asterisco, o que mais favorece dentro daquela família. Família sem marca
// (os neutros, nas cartelas de inverno) simplesmente não tem premium.
function paletteFromFamilies(families) {
  return PALETTE_LEVELS.flatMap((level, levelIndex) =>
    families.map(([nome, tons, premiumLevel], familyIndex) => {
      const color = { hex: tons[levelIndex].toUpperCase(), nome: `${nome} ${level}` };
      if (premiumLevel === levelIndex) {
        color.premium = true;
        color.familyIndex = familyIndex;
      }
      return color;
    }),
  );
}

// Na cartela as premium ficam espalhadas nível a nível; aqui voltam à ordem das
// famílias, que é como a cartela impressa se lê.
function premiumColors(palette) {
  return (palette || [])
    .filter((color) => color.premium)
    .sort((a, b) => (a.familyIndex ?? 0) - (b.familyIndex ?? 0));
}

// Algumas cartelas trazem as melhores como lista à parte, já nomeada; outras só
// marcam um tom por família dentro da própria grade.
function premiumForSeason(season) {
  if (season?.premium?.length) return season.premium;
  return premiumColors(primaryPaletteForSeason(season));
}

function paletteFromGrid(rows, families) {
  return rows.flatMap((row, rowIndex) =>
    row.map((hex, columnIndex) => ({
      hex: hex.toUpperCase(),
      nome: `${families[columnIndex]} ${PALETTE_LEVELS[rowIndex]}`,
    })),
  );
}

/* ---------- paletas pré-definidas (sistema das 12 estações) ---------- */
const SEASON_PRESETS = {
  "Primavera Clara": {
    estacao: "Primavera", temperatura: "quente", contraste: "baixo",
    resumo: "Pele clara e delicada, contraste suave entre pele, olhos e cabelo. Cores leves e levemente quentes valorizam mais que tons pesados ou muito escuros.",
    paleta: [["#F4C6A5","Pêssego claro"],["#A9DDD6","Água-marinha clara"],["#F2A0A0","Coral suave"],["#F6D97A","Amarelo manteiga"],["#F3B8C4","Rosa claro quente"],["#A8E0C0","Verde menta"],["#A9BEE8","Periwinkle claro"],["#F08A6C","Coral"],["#F5EBD8","Marfim quente"],["#E8C36A","Dourado claro"],["#F7C9D0","Rosa bebê"],["#A9D9E0","Azul-piscina claro"],["#D9E8A0","Verde-limão claro"],["#F5EAD0","Creme"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#000000","Preto"],["#5C1F2E","Vinho escuro"],["#8A8F94","Cinza frio"],["#1B2A4A","Azul-marinho"],["#4A2545","Ameixa escura"],["#3E2A1A","Marrom escuro"],["#3E1F42","Roxo profundo"]].map(([hex,nome])=>({hex,nome})),
  },
  "Primavera Quente": {
    estacao: "Primavera", temperatura: "quente", contraste: "médio",
    resumo: "Subtom quente e dourado, com boa saturação. Cores vívidas e quentes — corais, terracotas, dourados — realçam mais que tons frios ou apagados.",
    paleta: paletteFromGrid(
      [
        ["#c11843", "#502e89", "#462f87", "#0a2b72", "#045668", "#227692", "#208b8a", "#646520", "#284b2b", "#086f4d", "#686053", "#5a4d42", "#945b1b", "#804413", "#582001", "#74002a", "#981819", "#a62d29", "#c98e06", "#dba856"],
        ["#d92045", "#68229d", "#7658b6", "#0042a7", "#0885b3", "#3390a9", "#27b195", "#839e31", "#316f31", "#149b3a", "#777868", "#795c3e", "#c5752d", "#d3702e", "#9d441b", "#b71d28", "#d50b07", "#ca4a2b", "#eca316", "#f7bd5d"],
        ["#eb4b77", "#82229c", "#7f6cd4", "#305ad6", "#0ba2c1", "#3ec1cd", "#21c5b3", "#bac75c", "#4f9634", "#44be3f", "#a5a891", "#8a683a", "#dc8c43", "#df8c56", "#954b38", "#d0373d", "#ff3b3d", "#fe713b", "#fec843", "#facb61"],
        ["#f06d82", "#a560c9", "#978de4", "#5d86de", "#00bee2", "#65c2cb", "#50bab4", "#d8d677", "#8fbb4a", "#6dd781", "#bcbeaf", "#c29f6b", "#e5a76c", "#e5a881", "#eca279", "#d55869", "#fd7682", "#ffa288", "#f9d35b", "#f7e6ac"],
        ["#f8adb5", "#d793e8", "#c2b7ef", "#98b9fd", "#65e4ff", "#7fede6", "#7dd9c4", "#e4de98", "#b2d876", "#9bca94", "#eae6d6", "#d6bb8c", "#f0cb98", "#ebba99", "#fec8a3", "#e1818e", "#f98c7f", "#f8bfa2", "#f4e28c", "#faf19f"],
      ],
      PRIMAVERA_QUENTE_FAMILIES,
    ),
    evitar: [["#BFD9EA","Azul gelo"],["#E8B8C8","Rosa frio"],["#000000","Preto"],["#9A9691","Cinza"],["#5C1F2E","Vinho"],["#7A8A9A","Cinza-azulado"],["#5C4A7A","Roxo frio"]].map(([hex,nome])=>({hex,nome})),
  },
  "Primavera Brilhante": {
    estacao: "Primavera", temperatura: "neutra-quente", contraste: "alto",
    resumo: "Contraste alto e cores muito claras/vívidas nos olhos. Pede tons puros e brilhantes — nada de misturas apagadas ou acinzentadas.",
    paleta: [["#F2543F","Coral vivo"],["#E23B2E","Vermelho puro"],["#1FADA0","Turquesa"],["#F0B429","Amarelo dourado vivo"],["#4FA340","Verde grama"],["#F0507E","Rosa-choque coral"],["#2E5FA8","Azul royal quente"],["#F0701F","Laranja vivo"],["#FBFAF6","Branco"],["#8A3FA0","Violeta vivo"],["#F0E23C","Amarelo-limão"],["#1FAF6A","Verde-esmeralda vivo"],["#1FC2C2","Azul-turquesa vivo"],["#E0308A","Rosa-magenta"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#C9BBA3","Bege desbotado"],["#7A6650","Marrom barrento"],["#ADA593","Cinza-bege"],["#E8D9CE","Pastel desbotado"],["#B9AE86","Caqui"],["#4A3324","Marrom-café"],["#5A5650","Cinza-chumbo"]].map(([hex,nome])=>({hex,nome})),
  },
  "Verão Claro": {
    estacao: "Verão", temperatura: "fria", contraste: "baixo",
    resumo: "Pele clara e fria, contraste suave. Tons pastéis e acinzentados-frios favorecem mais que cores muito quentes ou muito escuras.",
    paleta: [["#B8CBE0","Azul pó"],["#C9C0DE","Lavanda"],["#F0C7D2","Rosa suave"],["#C9C7C2","Cinza claro"],["#D9A8B0","Rosa poeirento"],["#B0DAD0","Verde-água claro"],["#A9B8E0","Periwinkle"],["#C6AEC0","Malva"],["#ADD0CE","Azul-esverdeado pálido"],["#F2EFE9","Branco-creme frio"],["#C7DCEE","Azul-bebê"],["#C7E8DE","Verde-menta claro"],["#D9C9E8","Lilás claro"],["#E8D9D2","Bege rosado claro"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#E8752D","Laranja"],["#C9A227","Mostarda"],["#000000","Preto"],["#D6301F","Vermelho vivo"],["#8A5A3C","Marrom quente"],["#4A3324","Marrom-café"],["#708238","Verde-oliva"]].map(([hex,nome])=>({hex,nome})),
  },
  "Verão Frio": {
    estacao: "Verão", temperatura: "fria", contraste: "médio",
    resumo: "Subtom frio e rosado, contraste moderado. Azuis, ameixas e framboesas ficam melhores que tons dourados ou terrosos.",
    paleta: [["#4A6FA5","Azul cobalto suave"],["#B03A5B","Framboesa"],["#6B3F63","Ameixa"],["#C24E88","Fúcsia suave"],["#6E7480","Cinza-ardósia"],["#C7C3DE","Lavanda gelo"],["#3E8A85","Verde-azulado frio"],["#D68CA0","Rosa-chá"],["#22345C","Azul-marinho"],["#F2F2F0","Branco frio"],["#2E4A8A","Azul-royal frio"],["#A02E5C","Rosa-framboesa forte"],["#5C6A7A","Cinza-azulado"],["#F5F5F2","Branco-gelo"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#E8752D","Laranja"],["#E8A93B","Amarelo dourado"],["#8A5A3C","Marrom quente"],["#7A7A3C","Verde-oliva"],["#E24B36","Tomate"],["#D9B87A","Bege dourado"],["#C79A5B","Camelo"]].map(([hex,nome])=>({hex,nome})),
  },
  "Verão Suave": {
    estacao: "Verão", temperatura: "neutra-fria", contraste: "baixo",
    resumo: "Cores suaves e acinzentadas, baixo contraste entre pele, olhos e cabelo. Tons amenos e neutros valorizam mais que cores puras e muito vivas.",
    paleta: [["#7C93AD","Azul empoeirado"],["#A98CA0","Malva"],["#92A587","Verde-sálvia"],["#C99BA0","Rosa envelhecido"],["#A99885","Taupe"],["#A79AB0","Lavanda acinzentada"],["#6E9490","Verde-azulado acinzentado"],["#C79098","Rosa poeirento"],["#8C6B80","Ameixa suave"],["#ADA89E","Cinza-pedra"],["#7C9A8A","Verde-eucalipto"],["#B98C8C","Rosa-antigo"],["#5A6E82","Azul-acinzentado escuro"],["#7A6A5C","Marrom-taupe escuro"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#C6F02A","Verde-limão neon"],["#F0701F","Laranja vivo"],["#000000","Preto puro"],["#FFFFFF","Branco puro"],["#D6301F","Vermelho vivo"],["#E8C93C","Amarelo-ouro vivo"],["#E24B36","Vermelho-tomate"]].map(([hex,nome])=>({hex,nome})),
  },
  "Outono Suave": {
    estacao: "Outono", temperatura: "neutra-quente", contraste: "baixo",
    resumo: "Tons quentes e amenos, baixo contraste. Cores terrosas e suaves — sálvia, camelo, terracota suave — favorecem mais que cores puras e frias.",
    paleta: [["#7C7C4A","Oliva"],["#B08D57","Camelo"],["#B9714E","Terracota suave"],["#8A9A70","Verde-sálvia"],["#C9AE85","Bege quente"],["#B99656","Dourado envelhecido"],["#A05C45","Tijolo"],["#6E7A4A","Musgo"],["#A69A87","Cinza-quente"],["#C2A24A","Mostarda suave"],["#9AA070","Verde-oliva claro"],["#C98A63","Terracota clara"],["#D9C39F","Bege-areia"],["#8A6E52","Marrom-avelã"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#E8C7D2","Rosa gelo"],["#C2408A","Fúcsia"],["#000000","Preto"],["#6E8FBF","Azul frio"],["#C6F02A","Neon"],["#8A2EC2","Roxo vivo"],["#2E5FA8","Azul royal"]].map(([hex,nome])=>({hex,nome})),
  },
  "Outono Quente": {
    estacao: "Outono", temperatura: "quente", contraste: "médio",
    resumo: "Subtom quente e dourado com boa saturação. Terrosos vívidos — mostarda, ferrugem, oliva — realçam mais que tons frios, acinzentados ou muito contrastantes como o preto puro.",
    paleta: paletteFromGrid(
      [
        ["#4f452c", "#373f1b", "#2b4538", "#355152", "#2d6268", "#412d58", "#650f50", "#4f0325", "#56121d", "#64353b", "#aa303b", "#af2300", "#b24e10", "#79372e", "#4d2f2b", "#564031", "#3e3222", "#805a03", "#b26d05", "#3c1a0e"],
        ["#646521", "#244b2c", "#1d6560", "#224e59", "#1c7e87", "#6a357b", "#84206e", "#72133f", "#801825", "#9b5c65", "#ca3a47", "#e82e03", "#e46313", "#af3f29", "#83493d", "#765c3b", "#575733", "#b1841e", "#ca7d09", "#5f2c1f"],
        ["#a8a82c", "#29692a", "#458271", "#20797f", "#4b98a8", "#8f488d", "#9c3481", "#992d5f", "#af2d3f", "#c58d8e", "#d65662", "#d55738", "#e87a34", "#cb5f4b", "#a76356", "#bc9955", "#686751", "#dbac38", "#ea9925", "#a46642"],
        ["#9ba46b", "#4f9634", "#379a7c", "#38aeb8", "#68c1d5", "#a156a5", "#b763a4", "#c85a8d", "#c55d6a", "#d8baba", "#db8888", "#e37959", "#dc9261", "#bf796d", "#c3947e", "#bfa47c", "#a6967c", "#ae955c", "#ed9752", "#b88b62"],
        ["#b9b782", "#8fbb4a", "#8ecbb9", "#8ec9cf", "#80dae9", "#d093d7", "#bf82b9", "#da8eb2", "#c5828a", "#f0e3d8", "#edc3ba", "#e38382", "#e1b191", "#dfac99", "#ddab86", "#ddd69f", "#e8dccc", "#e9d260", "#edb450", "#f2b888"],
      ],
      OUTONO_QUENTE_FAMILIES,
    ),
    // as melhores vêm nomeadas na cartela, com nomes mais precisos que os que a
    // grade gera a partir da família e do nível — então entram como lista própria
    premium: [["#373F1B","Oliva profundo"],["#2B4538","Verde floresta quente"],["#2D6268","Petróleo"],["#646521","Verde oliva"],["#244B2C","Verde musgo"],["#1D6560","Teal quente"],["#29692A","Verde folha"],["#A8A82C","Oliva dourado"],["#805A03","Mostarda escura"],["#B26D05","Ocre"],["#DBAC38","Dourado"],["#CA7D09","Abóbora"],["#B24E10","Laranja queimado"],["#E87A34","Terracota"],["#D55738","Telha"],["#AF2D3F","Vermelho quente"],["#A76356","Argila"],["#4D2F2B","Chocolate"],["#B88B62","Camel"],["#ED9752","Pêssego queimado"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#FFFFFF","Branco óptico"],["#000000","Preto puro"],["#D9DDE5","Cinza gelo"],["#AEB6C2","Cinza azulado"],["#C0C0C0","Prata fria"],["#8E8792","Taupe frio"],["#CFE8FF","Azul gelo"],["#BDE0FE","Azul bebê frio"],["#5B7CFF","Azul royal frio"],["#0047AB","Azul cobalto"],["#D8C4F1","Lavanda gelada"],["#C8A2C8","Lilás frio"],["#F4A6C8","Rosa bebê frio"],["#FF00A8","Fúcsia"],["#D1007A","Magenta frio"],["#5A1636","Bordô azulado"],["#C0003C","Vermelho azulado"],["#BFE8DF","Menta fria"],["#B7FF00","Verde neon"],["#F4FF3A","Amarelo neon"]].map(([hex,nome])=>({hex,nome})),
  },
  "Outono Profundo": {
    estacao: "Outono", temperatura: "quente", contraste: "alto",
    resumo: "Cores escuras e quentes, contraste marcado. Tons profundos — chocolate, vinho, verde-floresta — favorecem mais que pastéis ou tons gelados.",
    paleta: [["#4A2E1E","Chocolate"],["#2E4A2E","Verde-floresta"],["#B04A1F","Laranja queimado"],["#A87F1F","Mostarda escura"],["#6B1F2E","Vinho"],["#1F4A4A","Petróleo"],["#3E2A1A","Café"],["#A87A2E","Dourado escuro"],["#9C4A2E","Ferrugem"],["#4A4A1F","Verde-oliva escuro"],["#4A1420","Vinho profundo"],["#33401F","Verde-azeitona escuro"],["#6B2E1F","Marrom-avermelhado"],["#8A6A2E","Dourado-bronze"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#F0C7D2","Rosa pastel"],["#BFD9EA","Azul-gelo"],["#D6D2CB","Cinza claro"],["#C6F02A","Neon"],["#B8D0E8","Azul-bebê"],["#D9C9E8","Lilás claro"],["#C7E8DE","Verde-menta claro"]].map(([hex,nome])=>({hex,nome})),
  },
  "Inverno Profundo": {
    estacao: "Inverno", temperatura: "neutra-fria", contraste: "alto",
    resumo: "Cores escuras e intensas, alto contraste. Tons profundos e saturados — preto, esmeralda, vinho — favorecem mais que pastéis ou tons terrosos claros.",
    paleta: paletteFromFamilies([
      ["Amarelo ouro", ["#aea309", "#eada06", "#f7ea36", "#ede791", "#f5f4e0"], 1],
      ["Lima fria", ["#909325", "#c0c42c", "#d3d656", "#dcdea1", "#f1f2e4"], 2],
      ["Verde oliva frio", ["#6f7a3d", "#92a24e", "#adba73", "#cad0ae", "#edefe7"], 2],
      ["Verde esmeralda", ["#04443d", "#037c70", "#08b5a3", "#31ddcc", "#96ded7"], 1],
      ["Teal profundo", ["#043c44", "#036e7c", "#08a1b5", "#31c9dd", "#96d6de"], 1],
      ["Verde petróleo", ["#0e3a3a", "#166969", "#239a9a", "#4cc2c2", "#a2d3d3"], 0],
      ["Turquesa", ["#173030", "#295756", "#3d7f7f", "#66a8a7", "#adc8c7"], 3],
      ["Verde menta", ["#1a2e27", "#2d5346", "#437a68", "#6ca291", "#afc5be"], 4],
      ["Verde acinzentado", ["#1b2c2d", "#2e5051", "#467577", "#6f9ea0", "#b0c4c4"], 2],
      ["Azul marinho", ["#141933", "#232c5d", "#354188", "#5e6ab1", "#a9aecb"], 1],
      ["Azul royal", ["#0e2139", "#173a69", "#245699", "#4d7fc1", "#a2b7d2"], 2],
      ["Azul elétrico", ["#042844", "#03477c", "#0869b5", "#3192dd", "#96bfde"], 2],
      ["Azul céu", ["#132134", "#203a5f", "#31568b", "#5a7fb4", "#a8b7cd"], 3],
      ["Azul sereno", ["#0d293b", "#154b6b", "#216e9c", "#4a96c5", "#a1c1d4"], 3],
      ["Periwinkle", ["#1b1b2c", "#2f3050", "#474876", "#70719f", "#b0b1c4"], 3],
      ["Violeta-índigo", ["#1c1235", "#311e61", "#492f8e", "#7258b7", "#b1a6ce"], 1],
      ["Roxo", ["#211433", "#3a225e", "#563489", "#7f5db2", "#b7a9cc"], 2],
      ["Ameixa", ["#271136", "#461d62", "#682d90", "#9056b8", "#bea6cf"], 0],
      ["Berry", ["#351231", "#611e59", "#8e2e83", "#b757ab", "#cea6c9"], 1],
      ["Magenta vinho", ["#3c0c20", "#6d1238", "#9f1d53", "#c8467c", "#d59fb5"], 2],
      ["Neutro frio", ["#111313", "#2d3c4b", "#8e8b7f", "#c8c8c8", "#fefefd"]],
    ]),
    evitar: [["#F0C7A0","Pêssego pastel"],["#D9C7A8","Bege"],["#B9713C","Laranja queimado"],["#8A5A3C","Marrom quente"],["#C9962C","Dourado"],["#9AA070","Verde-oliva claro"],["#D9B87A","Camelo claro"]].map(([hex,nome])=>({hex,nome})),
  },
  "Inverno Frio": {
    estacao: "Inverno", temperatura: "fria", contraste: "alto",
    resumo: "Subtom frio e contraste alto entre pele, olhos e cabelo. Cores puras e frias — azul, fúcsia, esmeralda — favorecem mais que tons quentes ou terrosos.",
    paleta: paletteFromFamilies([
      ["Amarelo limão", ["#b5a617", "#ebd81e", "#f0e256", "#ece6ac", "#f7f5e9"], 1],
      ["Lima fria", ["#9ca02c", "#cbd039", "#d8dc6a", "#e2e3b5", "#f5f5eb"], 2],
      ["Verde esmeralda", ["#04624e", "#00a380", "#00e0b0", "#4ee4c4", "#a8e6d8"], 2],
      ["Verde jade", ["#046162", "#00a2a3", "#00dfe0", "#4ee4e4", "#a8e5e6"], 2],
      ["Turquesa", ["#13534d", "#1b897e", "#25bcad", "#66ccc2", "#b2dcd8"], 2],
      ["Verde menta", ["#21453f", "#327167", "#459b8e", "#7cb6ad", "#bbd3cf"], 3],
      ["Teal profundo", ["#08555e", "#088d9c", "#0ac1d6", "#55d0dd", "#abdde3"], 1],
      ["Verde acinzentado", ["#2b3b36", "#436058", "#5c8478", "#8ca69f", "#c1ccc9"], 2],
      ["Azul marinho", ["#042e62", "#0049a3", "#0064e0", "#4e91e4", "#a8c4e6"], 0],
      ["Azul royal", ["#0f2757", "#143d8f", "#1b53c5", "#6086d2", "#afbfde"], 2],
      ["Azul elétrico", ["#043e62", "#0064a3", "#008ae0", "#4eaae4", "#a8cee6"], 2],
      ["Azul céu", ["#1b314b", "#284d7b", "#376aa9", "#7395bf", "#b7c5d7"], 2],
      ["Azul sereno", ["#17334f", "#215283", "#2d71b4", "#6c9ac6", "#b4c7d9"], 3],
      ["Periwinkle", ["#112655", "#173b8c", "#2051c0", "#6384cf", "#b1bedd"], 3],
      ["Violeta-índigo", ["#2b1a4c", "#44267d", "#5d35ac", "#8c71c1", "#c2b7d7"], 1],
      ["Roxo", ["#341c4a", "#53297a", "#7339a8", "#9b74be", "#c8b8d6"], 1],
      ["Orquídea", ["#41253b", "#6a3a5f", "#914f83", "#af83a6", "#d0becc"], 2],
      ["Magenta", ["#60062d", "#a00347", "#dc0462", "#e25090", "#e5a9c3"], 2],
      ["Rosa pink", ["#531331", "#8a194f", "#be236d", "#cd6597", "#dcb2c6"], 3],
      ["Neutro frio", ["#111313", "#2d3c4b", "#8e8b7f", "#c8c8c8", "#fefefd"]],
    ]),
    evitar: [["#E8752D","Laranja"],["#8A5A3C","Marrom quente"],["#C9A227","Mostarda"],["#708238","Verde-oliva"],["#F0A97A","Pêssego"],["#D9C39F","Bege-areia"],["#5C6E2E","Verde-musgo"]].map(([hex,nome])=>({hex,nome})),
  },
  "Inverno Brilhante": {
    estacao: "Inverno", temperatura: "neutra-fria", contraste: "alto",
    resumo: "Contraste muito alto e cores vívidas nos olhos. Pede tons puros e vibrantes — nada de misturas acinzentadas ou terrosas.",
    paleta: [["#D6172B","Vermelho verdadeiro"],["#E0308A","Fúcsia vivo"],["#1E5CE0","Azul elétrico"],["#16A05C","Esmeralda vivo"],["#16130F","Preto"],["#FBFAF6","Branco puro"],["#F03878","Rosa-choque"],["#2E3EA0","Azul royal"],["#7A2EC2","Roxo vivo"],["#F2E85C","Amarelo-gelo"],["#B9E01F","Verde-limão vivo"],["#1FC2E0","Azul-ciano"],["#C2007A","Magenta puro"],["#F2C400","Amarelo-ouro vivo"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#D9C7A8","Bege"],["#8A7256","Marrom baço"],["#708238","Oliva"],["#B9AE86","Caqui"],["#E8D9CE","Pastel desbotado"],["#8A6E52","Marrom-avelã"],["#C9683F","Terracota"]].map(([hex,nome])=>({hex,nome})),
  },
};
const SEASON_GROUPS = [
  { name: "Primavera", subtons: ["Primavera Clara", "Primavera Quente", "Primavera Brilhante"] },
  { name: "Verão", subtons: ["Verão Claro", "Verão Frio", "Verão Suave"] },
  { name: "Outono", subtons: ["Outono Suave", "Outono Quente", "Outono Profundo"] },
  { name: "Inverno", subtons: ["Inverno Profundo", "Inverno Frio", "Inverno Brilhante"] },
];

// cada subtom compartilha sua característica secundária (clara/quente/brilhante/fria/suave/profunda)
// com um único subtom "irmão" de outra estação — a cartela irmã traz cores extras que também funcionam.
const SISTER_MAP = {
  "Primavera Clara": "Verão Claro",
  "Verão Claro": "Primavera Clara",
  "Primavera Quente": "Outono Quente",
  "Outono Quente": "Primavera Quente",
  "Primavera Brilhante": "Inverno Brilhante",
  "Inverno Brilhante": "Primavera Brilhante",
  "Verão Frio": "Inverno Frio",
  "Inverno Frio": "Verão Frio",
  "Verão Suave": "Outono Suave",
  "Outono Suave": "Verão Suave",
  "Outono Profundo": "Inverno Profundo",
  "Inverno Profundo": "Outono Profundo",
};

// para onde o botão "voltar" leva quando não há histórico de navegação
// (ex.: quem abre o app já com um resultado salvo). null = sem botão.
const BACK_FALLBACK = {
  "upload-face": "intro",
  "select-manual": "intro",
  result: null,
  "upload-clothing": "result",
  "pick-point": "upload-clothing",
  "match-result": "result",
};

/* ---------- helpers ---------- */
function resizeImage(file, maxDim = 768) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve({
          dataUrl: canvas.toDataURL("image/jpeg", 0.85),
          canvas,
          ctx,
          width,
          height,
        });
      };
      img.onerror = () => reject(new Error("Não consegui abrir essa imagem."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Não consegui ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function hexToRgb(hex) {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.substring(0, 2), 16),
    g: parseInt(m.substring(2, 4), 16),
    b: parseInt(m.substring(4, 6), 16),
  };
}
function rgbToHex({ r, g, b }) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}
function dist(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

// A cor da luz vira a cor da roupa na foto: lâmpada amarela puxa tudo pro quente,
// sombra puxa pro azul. As superfícies mais claras da cena são as que mais refletem
// a luz pura, então a média delas é uma boa estimativa da cor da iluminação.
function estimateIlluminant(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const total = width * height;
  const stride = Math.max(1, Math.round(total / 30000));
  const samples = [];
  for (let p = 0; p < total; p += stride) {
    const i = p * 4;
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // pixel estourado perdeu a informação de cor — não diz nada sobre a luz
    if (r >= 250 && g >= 250 && b >= 250) continue;
    samples.push({ r, g, b, y: 0.2126 * r + 0.7152 * g + 0.0722 * b });
  }
  if (!samples.length) return null;
  samples.sort((a, b) => b.y - a.y);
  const brightest = samples.slice(0, Math.max(1, Math.round(samples.length * 0.1)));
  const mean = (channel) =>
    brightest.reduce((sum, pixel) => sum + pixel[channel], 0) / brightest.length;
  return { r: mean("r"), g: mean("g"), b: mean("b") };
}

// Reequilibra os canais como se a foto tivesse sido tirada sob luz neutra.
function whiteBalance(rgb, illuminant) {
  if (!illuminant) return rgb;
  const gray = (illuminant.r + illuminant.g + illuminant.b) / 3;
  // foto escura demais: a estimativa fica ruidosa e corrigir só piora
  if (gray < 40) return rgb;
  const correct = (value, reference) => {
    // ganho limitado: tira o dominante da luz sem inventar cor onde a foto é puxada de verdade
    const gain = Math.max(0.75, Math.min(1.35, gray / Math.max(1, reference)));
    return Math.max(0, Math.min(255, value * gain));
  };
  return {
    r: correct(rgb.r, illuminant.r),
    g: correct(rgb.g, illuminant.g),
    b: correct(rgb.b, illuminant.b),
  };
}

function rgbToLab({ r, g, b }) {
  const linearize = (value) => {
    const channel = value / 255;
    return channel > 0.04045 ? ((channel + 0.055) / 1.055) ** 2.4 : channel / 12.92;
  };
  const red = linearize(r);
  const green = linearize(g);
  const blue = linearize(b);
  const x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047;
  const y = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883;
  const pivot = (value) => (value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116);
  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// Mesmo com o branco corrigido, sombra e reflexo ainda mexem no brilho. O matiz é
// o que define se a cor é da cartela, então L pesa menos que a e b na comparação.
const LIGHTNESS_WEIGHT = 0.7;

function perceptualDistance(rgb, color) {
  const first = rgbToLab(rgb);
  const second = rgbToLab(hexToRgb(color.hex));
  return Math.sqrt(
    ((first.l - second.l) * LIGHTNESS_WEIGHT) ** 2 +
      (first.a - second.a) ** 2 +
      (first.b - second.b) ** 2,
  );
}

function closestColor(rgb, colors, source) {
  return colors.reduce((closest, color) => {
    const d = perceptualDistance(rgb, color);
    return !closest || d < closest.d ? { d, color, source } : closest;
  }, null);
}

function isPresetSeason(season) {
  const preset = SEASON_PRESETS[season?.subtom];
  if (!preset) return false;
  return (
    season.origem === "preset" ||
    (season.resumo === preset.resumo &&
      season.estacao === preset.estacao &&
      season.temperatura === preset.temperatura &&
      season.contraste === preset.contraste)
  );
}

// Os chips da lista de colorações são a impressão que a pessoa tem da cartela
// antes de abrir. Pegar as primeiras cores mostrava só o nível mais profundo das
// primeiras famílias — quatro tons escuros e frios para a Primavera Quente, que
// não se parecem nada com ela. Numa cartela completa o nível do meio representa
// melhor, e as famílias entram espalhadas em vez de todas do mesmo canto.
function seasonSwatches(palette, count = 4) {
  if (!palette?.length) return [];
  const levels = PALETTE_LEVELS.length;
  let source = palette;
  if (palette.length >= 50 && palette.length % levels === 0) {
    const families = palette.length / levels;
    const middle = Math.floor(levels / 2);
    source = palette.slice(middle * families, (middle + 1) * families);
  }
  if (source.length <= count) return source;
  // amostra o meio de cada bloco em vez das pontas: pegar da primeira e da última
  // família cai sempre nos amarelos e no cinza neutro, as menos características.
  return Array.from(
    { length: count },
    (_, i) => source[Math.round(((i + 0.5) * source.length) / count)],
  );
}

function primaryPaletteForSeason(season) {
  const presetPalette = SEASON_PRESETS[season?.subtom]?.paleta || [];
  if (isPresetSeason(season)) return presetPalette;
  return [...(season?.paleta || []), ...presetPalette].filter(
    (color, index, list) => list.findIndex((item) => item.hex === color.hex) === index,
  );
}

function matchClothing(dominantRgb, season) {
  const primaryPalette = primaryPaletteForSeason(season);
  const sisterName = SISTER_MAP[season.subtom];
  const sisterPalette = sisterName ? SEASON_PRESETS[sisterName]?.paleta || [] : [];
  const ownBest = closestColor(dominantRgb, primaryPalette, "principal");
  const sisterBest = closestColor(dominantRgb, sisterPalette, "irmã");
  const bestAvoid = closestColor(dominantRgb, season.evitar || [], "evitar");

  // Fotos, compressão e luz alteram um pouco o RGB. Uma cor próxima da cartela
  // principal só é recusada quando ela está claramente colada a um tom a evitar.
  // A cartela irmã é consultada apenas quando a principal realmente não combina.
  const candidateMatches = (candidate, tolerance) => {
    if (!candidate) return false;
    const exactPalette = candidate.d <= 8;
    const exactAvoid = bestAvoid?.d <= 8;
    const closeEnough = candidate.d <= tolerance;
    const notDominatedByAvoid = !bestAvoid || candidate.d <= bestAvoid.d + 8;
    const clearlyCloserToPalette = !bestAvoid || candidate.d + 5 < bestAvoid.d;
    return (
      exactPalette ||
      (!exactAvoid && ((closeEnough && notDominatedByAvoid) || clearlyCloserToPalette))
    );
  };

  const ownMatches = candidateMatches(ownBest, 32);
  const sisterMatches = !ownMatches && candidateMatches(sisterBest, 26);
  const combina = ownMatches || sisterMatches;
  const best = ownMatches
    ? ownBest
    : sisterMatches
      ? sisterBest
      : !sisterBest || ownBest.d <= sisterBest.d
        ? ownBest
        : sisterBest;
  const exactPalette = best.d <= 8;

  const proximity = Math.max(0, Math.min(100, 100 - best.d * 1.8));
  const totalDistance = best.d + (bestAvoid?.d || 0);
  const relative = bestAvoid && totalDistance > 0 ? (bestAvoid.d / totalDistance) * 100 : proximity;
  let score = combina
    ? Math.round(proximity * 0.75 + Math.max(50, relative) * 0.25)
    : Math.round(Math.min(49, relative * 0.8));
  if (best.d <= 4) score = 100;
  else if (exactPalette) score = Math.max(90, score);

  const suggestions = primaryPalette
    .map((color) => ({ d: perceptualDistance(dominantRgb, color), color }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((s) => s.color);
  return {
    combina,
    score,
    suggestions,
    closest: combina ? best.color : bestAvoid?.color || best.color,
    dominantHex: rgbToHex(dominantRgb),
  };
}

function verdictText(m) {
  if (!m.combina) return "Essa cor foge da sua paleta — puxa mais pro grupo que costuma brigar com sua coloração.";
  if (m.score >= 80) return "Combina lindamente com sua paleta! 🤍";
  if (m.score >= 60) return "Combina bem, pode usar com confiança.";
  if (m.score >= 40) return "Tá no limite — funciona melhor em acessório do que como peça principal.";
  return "Não é a cor mais favorável pra sua coloração.";
}

/* ---------- grade de cores ---------- */
// Uma única forma de mostrar cartela no app: quadradinhos retos numa grade.
// Cartela completa tem uma família por coluna e um nível por linha, e nem toda
// cartela tem o mesmo número de famílias — daí as colunas saírem do tamanho dela.
//
// As outras usam a largura que existe. Com o quadradinho de tamanho fixo, contar
// colunas sem olhar a largura sobrava metade do painel vazio e quebrava a cartela
// em fileiras curtas à toa — 19 cores viravam quatro fileiras de cinco. Aqui a
// conta é: quantos cabem por fileira, quantas fileiras isso dá, e então divide
// por igual entre essas fileiras, pra não terminar com uma fileira quase vazia.
function columnsFor(count, size, gap, available) {
  const levels = PALETTE_LEVELS.length;
  if (count >= 50 && count % levels === 0) return count / levels;
  const fit = available > 0 ? Math.floor((available + gap) / (size + gap)) : count;
  const perRow = Math.max(1, Math.min(count, fit));
  const rows = Math.ceil(count / perRow);
  return Math.ceil(count / rows);
}

// Quadradinho do mesmo tamanho em toda cartela, tenha ela 9 cores ou 105 — antes
// o tamanho saía da largura dividida pelas colunas, e cada coloração aparecia
// numa escala diferente. Cartela larga passa a rolar de lado dentro do painel.
const SWATCH_SIZE = 32;

function Palette({ colors, columns, interactive = true, hint = false, size = SWATCH_SIZE }) {
  const [selected, setSelected] = useState(null);
  const scrollRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  const [available, setAvailable] = useState(0);
  const active = selected != null ? colors[selected] : null;
  const gap = Math.max(3, Math.round(size * 0.12));
  const padding = gap + 2;
  const cols = columns || columnsFor(colors.length, size, gap, available - padding * 2);

  // quantas colunas cabem e se sobrou conteúdo dependem da largura da tela, então
  // as duas coisas só dá pra saber medindo o painel depois que ele existe.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => {
      setAvailable(el.clientWidth);
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [colors, cols, size]);

  return (
    <div>
      <div style={{ position: "relative" }}>
        <div ref={scrollRef} style={{ overflowX: "auto", borderRadius: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, ${size}px)`,
              gap,
              padding: gap + 2,
              background: "rgba(255,255,255,0.38)",
              borderRadius: 10,
              width: "max-content",
              minWidth: "100%",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
          >
            {colors.map((c, i) => {
              const label = c.nome ? `${c.nome} · ${c.hex}` : c.hex;
              const isActive = selected === i;
              return (
                <button
                  key={c.hex + i}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={interactive ? isActive : undefined}
                  disabled={!interactive}
                  onClick={() => setSelected(isActive ? null : i)}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    background: c.hex,
                    borderRadius: 4,
                    padding: 0,
                    cursor: interactive ? "pointer" : "default",
                    border: isActive
                      ? `2px solid ${T.ink}`
                      : "1px solid rgba(0,0,0,0.08)",
                  }}
                />
              );
            })}
          </div>
        </div>
        {overflowing && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 28,
              height: "100%",
              borderRadius: "0 10px 10px 0",
              background: `linear-gradient(to right, rgba(237,234,226,0), ${T.paper})`,
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      {(interactive || overflowing) && (
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: active ? T.ink : T.muted,
            marginTop: 8,
            minHeight: 16,
            letterSpacing: 0.3,
          }}
        >
          {active
            ? `${active.nome || "cor"} · ${active.hex}`
            : overflowing
              ? `arraste pro lado para ver as ${cols} famílias`
              : hint
                ? "toque numa cor para ver o nome"
                : ""}
        </div>
      )}
    </div>
  );
}

/* ---------- upload box ---------- */
function UploadBox({ label, sublabel, onFile, busy }) {
  const inputRef = useRef(null);
  return (
    <div
      onClick={() => !busy && inputRef.current?.click()}
      style={{
        border: `1.5px dashed ${T.line}`,
        borderRadius: 16,
        padding: "36px 20px",
        textAlign: "center",
        cursor: busy ? "default" : "pointer",
        background: T.paper2,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div style={{ fontFamily: "'Lora', serif", fontSize: 20, color: T.ink, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: T.muted, fontFamily: "'Inter', sans-serif" }}>{sublabel}</div>
    </div>
  );
}

/* ---------- main app ---------- */
export default function App() {
  const [step, setStep] = useState("loading");
  const [history, setHistory] = useState([]);
  const [season, setSeason] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [matchResult, setMatchResult] = useState(null);
  const [clothingPreview, setClothingPreview] = useState(null);
  const [tapImage, setTapImage] = useState(null);
  const [tapPoint, setTapPoint] = useState(null);

  // avança guardando de onde veio, pra o "voltar" refazer o caminho ao contrário
  function go(next) {
    setHistory((h) => [...h, step]);
    setStep(next);
  }
  // recomeça um trecho do fluxo: a tela vira raiz e o "voltar" usa o fallback
  function goRoot(next) {
    setHistory([]);
    setStep(next);
  }
  function goBack() {
    if (history.length) {
      setStep(history[history.length - 1]);
      setHistory(history.slice(0, -1));
      return;
    }
    const fallback = BACK_FALLBACK[step];
    if (fallback) setStep(fallback);
  }

  // telas sem volta: a inicial e as que estão no meio de um processamento
  const backTarget =
    step === "loading" || step === "intro" || step === "analyzing"
      ? null
      : history.length
        ? history[history.length - 1]
        : BACK_FALLBACK[step] || null;

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = window.localStorage.getItem("coloracao:resultado");
        if (saved) {
          const parsed = JSON.parse(saved);
          const preset = SEASON_PRESETS[parsed.subtom];
          const migrated = isPresetSeason(parsed)
            ? { subtom: parsed.subtom, ...preset, origem: "preset" }
            : parsed;
          setSeason(migrated);
          if (migrated !== parsed) {
            window.localStorage.setItem("coloracao:resultado", JSON.stringify(migrated));
          }
          setStep("result");
          return;
        }
      } catch (e) {}
      setStep("intro");
    })();
  }, []);

  async function handleFaceFile(file) {
    setErrorMsg("");
    setStep("analyzing");
    try {
      const { dataUrl } = await resizeImage(file, 768);
      const base64 = dataUrl.split(",")[1];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1200,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
                { type: "text", text: USER_PROMPT },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      const textBlock = data.content?.find((b) => b.type === "text");
      if (!textBlock) throw new Error("Resposta vazia da IA.");
      const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.paleta || !parsed.evitar) throw new Error("Resposta incompleta.");
      const analyzed = { ...parsed, origem: "analise" };
      setSeason(analyzed);
      try {
        window.localStorage.setItem("coloracao:resultado", JSON.stringify(analyzed));
      } catch (e) {}
      goRoot("result");
    } catch (err) {
      console.error(err);
      setErrorMsg("Não consegui analisar essa foto. Tenta outra com luz natural e o rosto bem visível, sem filtro.");
      setStep("upload-face");
    }
  }

  async function handleClothingFile(file) {
    setErrorMsg("");
    try {
      const resized = await resizeImage(file, 900);
      // a cor da luz é uma propriedade da foto inteira, então é estimada uma vez só
      const illuminant = estimateIlluminant(resized.ctx, resized.width, resized.height);
      setTapImage({ ...resized, illuminant });
      setTapPoint(null);
      go("pick-point");
    } catch (err) {
      setErrorMsg("Não consegui abrir essa foto. Tenta outra imagem.");
      setStep("upload-clothing");
    }
  }

  function handleImageTap(e) {
    if (!tapImage) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const yRatio = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const px = Math.round(xRatio * tapImage.width);
    const py = Math.round(yRatio * tapImage.height);
    const box = Math.max(3, Math.min(10, Math.round(Math.min(tapImage.width, tapImage.height) * 0.01)));
    const x0 = Math.max(0, px - box);
    const y0 = Math.max(0, py - box);
    const w = Math.min(tapImage.width - x0, box * 2);
    const h = Math.min(tapImage.height - y0, box * 2);
    const data = tapImage.ctx.getImageData(x0, y0, w, h).data;
    const centerData = tapImage.ctx.getImageData(
      Math.min(tapImage.width - 1, Math.max(0, px)),
      Math.min(tapImage.height - 1, Math.max(0, py)),
      1,
      1,
    ).data;
    const center = { r: centerData[0], g: centerData[1], b: centerData[2] };
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] };
      if (dist(pixel, center) <= 65) pixels.push(pixel);
    }
    const sample = pixels.length ? pixels : [center];
    const median = (channel) => {
      const values = sample.map((pixel) => pixel[channel]).sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    };
    const raw = { r: median("r"), g: median("g"), b: median("b") };
    const rgb = whiteBalance(raw, tapImage.illuminant);
    setTapPoint({ xPct: xRatio * 100, yPct: yRatio * 100, rgb, raw });
  }

  function confirmTapPoint() {
    if (!tapPoint || !tapImage) return;
    const result = matchClothing(tapPoint.rgb, season);
    setMatchResult(result);
    setClothingPreview(tapImage.dataUrl);
    go("match-result");
  }

  async function selectPreset(name) {
    const preset = SEASON_PRESETS[name];
    const full = { subtom: name, ...preset, origem: "preset" };
    setSeason(full);
    try {
      window.localStorage.setItem("coloracao:resultado", JSON.stringify(full));
    } catch (e) {}
    goRoot("result");
  }

  async function resetAll() {
    try {
      window.localStorage.removeItem("coloracao:resultado");
    } catch (e) {}
    setSeason(null);
    setMatchResult(null);
    setClothingPreview(null);
    goRoot("upload-face");
  }

  const wrap = {
    minHeight: "100vh",
    background: T.paper,
    fontFamily: "'Inter', sans-serif",
    color: T.ink,
    display: "flex",
    justifyContent: "center",
    padding: "28px 16px 60px",
  };
  const card = { width: "100%", maxWidth: 460 };
  const eyebrow = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: 2,
    color: T.muted,
    textTransform: "uppercase",
    marginBottom: 10,
  };
  const h1 = { fontFamily: "'Lora', serif", fontSize: 34, fontWeight: 500, lineHeight: 1.15, margin: 0 };
  const btnPrimary = {
    background: T.accent,
    color: "#F5F3EE",
    border: "none",
    borderRadius: 999,
    padding: "14px 26px",
    fontFamily: "'Inter', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  };
  const btnGhost = {
    background: "transparent",
    color: T.accent,
    border: `1px solid ${T.line}`,
    borderRadius: 999,
    padding: "12px 26px",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    width: "100%",
  };

  const btnBack = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: T.paper2,
    color: T.accent,
    border: `1px solid ${T.line}`,
    borderRadius: 999,
    padding: "8px 16px 8px 12px",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    marginBottom: 18,
  };

  return (
    <div style={wrap}>
      <div style={card}>
        {backTarget && (
          <button style={btnBack} onClick={goBack} aria-label="Voltar para a tela anterior">
            <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>
              ←
            </span>
            Voltar
          </button>
        )}

        {step === "loading" && <div style={{ textAlign: "center", color: T.muted, paddingTop: 80 }}>carregando…</div>}

        {step === "intro" && (
          <div style={{ textAlign: "center" }}>
            <div style={eyebrow}>colorimetria pessoal</div>
            <h1 style={h1}>
              Sua <em style={{ fontStyle: "italic" }}>estação</em>
            </h1>
            <p style={{ color: T.muted, fontSize: 15, margin: "14px 0 28px", lineHeight: 1.5 }}>
              Uma foto do seu rosto revela seu subtom, seu contraste e a paleta de cores que mais te favorece.
              Depois, teste qualquer roupa pra ver se ela combina com você.
            </p>
            <div style={{ margin: "24px 0 30px" }}>
              <Palette
                interactive={false}
                columns={6}
                size={54}
                colors={[
                  { hex: "#C9583F" },
                  { hex: "#E8C36A" },
                  { hex: "#4A6C6F" },
                  { hex: "#B5A48C" },
                  { hex: "#3E4A63" },
                  { hex: "#8C5E8A" },
                ]}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={btnPrimary} onClick={() => go("upload-face")}>
                Descobrir minha coloração
              </button>
              <button style={btnGhost} onClick={() => go("select-manual")}>
                Já sei minha coloração
              </button>
            </div>
          </div>
        )}

        {step === "upload-face" && (
          <div>
            <div style={eyebrow}>passo 1 de 2</div>
            <h1 style={{ ...h1, fontSize: 26, marginBottom: 8 }}>Foto do seu rosto</h1>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Luz natural, sem maquiagem pesada e sem filtro dá o resultado mais fiel. Cabelo preso ajuda a
              revelar melhor pele e olhos.
            </p>
            {errorMsg && (
              <div style={{ background: "#F3E3DF", color: T.bad, borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>
                {errorMsg}
              </div>
            )}
            <UploadBox label="Enviar foto" sublabel="toque para escolher da galeria ou tirar uma foto" onFile={handleFaceFile} />
            <button
              style={{ ...btnGhost, marginTop: 14, border: "none", color: T.muted, textDecoration: "underline" }}
              onClick={() => go("select-manual")}
            >
              Já sei minha coloração
            </button>
          </div>
        )}

        {step === "select-manual" && (
          <div>
            <div style={eyebrow}>seleção manual</div>
            <h1 style={{ ...h1, fontSize: 26, marginBottom: 8 }}>Qual é a sua?</h1>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 22, lineHeight: 1.5 }}>
              Toque no subtom que já sabe ser o seu.
            </p>
            {SEASON_GROUPS.map((group) => (
              <div key={group.name} style={{ marginBottom: 22 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: T.muted, marginBottom: 10 }}>
                  {group.name.toUpperCase()}
                </div>
                {/* cada estação tem exatamente três subtons, então as três colunas
                    deixam a estação inteira numa linha só */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  {group.subtons.map((name) => (
                    <button
                      key={name}
                      onClick={() => selectPreset(name)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: 8,
                        textAlign: "center",
                        background: T.paper2,
                        border: `1px solid ${T.line}`,
                        borderRadius: 12,
                        padding: "12px 6px",
                        cursor: "pointer",
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 12.5,
                        lineHeight: 1.3,
                        color: T.ink,
                        height: "100%",
                      }}
                    >
                      <span style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {seasonSwatches(SEASON_PRESETS[name].paleta).map((c, i) => (
                          <span
                            key={i}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              background: c.hex,
                              border: "1px solid rgba(0,0,0,0.08)",
                            }}
                          />
                        ))}
                      </span>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button style={{ ...btnGhost, marginTop: 4 }} onClick={goBack}>
              Voltar
            </button>
          </div>
        )}

        {step === "analyzing" && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={eyebrow}>analisando</div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 22, margin: "10px 0 24px" }}>
              Lendo pele, olhos e cabelo…
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              {["#C9583F", "#E8C36A", "#4A6C6F", "#3E4A63"].map((h, i) => (
                <div
                  key={h}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: h,
                    animation: `pulse 1s ${i * 0.15}s infinite ease-in-out`,
                  }}
                />
              ))}
            </div>
            <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
          </div>
        )}

        {step === "result" && season && (
          <div>
            <div style={eyebrow}>seu resultado</div>
            <h1 style={{ ...h1, fontSize: 30 }}>{season.subtom}</h1>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 6, marginBottom: 16 }}>
              temperatura {season.temperatura} · contraste {season.contraste}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: T.ink, marginBottom: 24 }}>{season.resumo}</p>

            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: T.muted, marginBottom: 12 }}>
              SUA PALETA · {primaryPaletteForSeason(season).length} TONS
            </div>
            <Palette key={`paleta-${season.subtom}`} colors={primaryPaletteForSeason(season)} hint />

            {premiumForSeason(season).length > 0 && (
              <>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: T.muted, margin: "28px 0 4px" }}>
                  CORES PREMIUM · {premiumForSeason(season).length} TONS
                </div>
                <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5, marginBottom: 12 }}>
                  O tom que mais favorece dentro de cada família da sua cartela. São as cores pra investir —
                  peça-chave, look de evento, o que fica perto do rosto.
                </p>
                <Palette
                  key={`premium-${season.subtom}`}
                  colors={premiumForSeason(season)}
                  hint
                />
              </>
            )}

            {SISTER_MAP[season.subtom] && SEASON_PRESETS[SISTER_MAP[season.subtom]] && (
              <>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: T.muted, margin: "28px 0 4px" }}>
                  CARTELA IRMÃ · {SISTER_MAP[season.subtom].toUpperCase()}
                </div>
                <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5, marginBottom: 12 }}>
                  Compartilha a característica principal com a sua. Se tiver uma peça amada fora da sua cartela, essas
                  cores extras também costumam funcionar.
                </p>
                <Palette
                  key={`irma-${season.subtom}`}
                  colors={SEASON_PRESETS[SISTER_MAP[season.subtom]].paleta}
                />
              </>
            )}

            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: T.muted, margin: "28px 0 12px" }}>
              EVITAR
            </div>
            <Palette key={`evitar-${season.subtom}`} colors={season.evitar} />

            <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={btnPrimary} onClick={() => go("upload-clothing")}>
                Testar uma roupa
              </button>
              <button style={btnGhost} onClick={resetAll}>
                Refazer análise por foto
              </button>
              <button
                style={{ ...btnGhost, border: "none", color: T.muted, textDecoration: "underline" }}
                onClick={() => go("select-manual")}
              >
                Escolher outra coloração manualmente
              </button>
            </div>
          </div>
        )}

        {step === "upload-clothing" && (
          <div>
            <div style={eyebrow}>passo 2 de 2</div>
            <h1 style={{ ...h1, fontSize: 26, marginBottom: 8 }}>Foto da roupa</h1>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Pode ser qualquer foto — mesmo com fundo — porque no próximo passo você toca exatamente onde a peça está.
            </p>
            {errorMsg && (
              <div style={{ background: "#F3E3DF", color: T.bad, borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>
                {errorMsg}
              </div>
            )}
            <UploadBox label="Enviar foto da roupa" sublabel="toque para escolher ou tirar uma foto" onFile={handleClothingFile} />
            <button style={{ ...btnGhost, marginTop: 16 }} onClick={goBack}>
              Voltar pra minha paleta
            </button>
          </div>
        )}

        {step === "pick-point" && tapImage && (
          <div>
            <div style={eyebrow}>toque na peça</div>
            <h1 style={{ ...h1, fontSize: 26, marginBottom: 8 }}>Onde está a roupa?</h1>
            <p style={{ color: T.muted, fontSize: 13.5, marginBottom: 12, lineHeight: 1.45 }}>
              Toque exatamente em cima do tecido da peça. A luz da foto é compensada
              automaticamente, então sombra e lâmpada amarela pesam menos no resultado.
            </p>
            {/* a foto é limitada em altura pra o botão continuar visível sem rolar.
                largura automática mantém o retângulo da imagem colado no elemento,
                senão a conta do ponto tocado sai do lugar. */}
            <div
              style={{
                position: "relative",
                borderRadius: 6,
                overflow: "hidden",
                lineHeight: 0,
                width: "fit-content",
                maxWidth: "100%",
                margin: "0 auto",
              }}
            >
              <img
                src={tapImage.dataUrl}
                alt="foto enviada"
                onClick={handleImageTap}
                style={{
                  display: "block",
                  width: "auto",
                  height: "auto",
                  maxWidth: "100%",
                  maxHeight: "44vh",
                  cursor: "crosshair",
                }}
              />
              {tapPoint && (
                <div
                  style={{
                    position: "absolute",
                    left: `${tapPoint.xPct}%`,
                    top: `${tapPoint.yPct}%`,
                    width: 26,
                    height: 26,
                    borderRadius: 4,
                    transform: "translate(-50%,-50%)",
                    border: "3px solid #fff",
                    boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
                    background: rgbToHex(tapPoint.rgb),
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            {tapPoint ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 4, background: rgbToHex(tapPoint.rgb), border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0 }} />
                <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.4 }}>
                  cor da peça já corrigida pela luz da foto — toque em outro ponto pra ajustar
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: T.muted, marginTop: 12 }}>nenhum ponto tocado ainda</div>
            )}
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <button style={btnPrimary} disabled={!tapPoint} onClick={confirmTapPoint}>
                Usar essa cor
              </button>
              <button style={btnGhost} onClick={goBack}>
                Trocar foto
              </button>
            </div>
          </div>
        )}

        {step === "match-result" && matchResult && season && (
          <div style={{ textAlign: "center" }}>
            <div style={eyebrow}>resultado do teste</div>
            {clothingPreview && (
              <img
                src={clothingPreview}
                alt="roupa testada"
                style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 6, margin: "14px auto", border: "1px solid rgba(0,0,0,0.08)" }}
              />
            )}
            <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
              <div>
                <div style={{ width: 46, height: 46, borderRadius: 4, background: matchResult.dominantHex, border: "1px solid rgba(0,0,0,0.1)", margin: "0 auto" }} />
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.muted, marginTop: 4 }}>
                  cor identificada
                </div>
              </div>
            </div>

            <div
              style={{
                fontFamily: "'Lora', serif",
                fontSize: 26,
                fontWeight: 500,
                color: matchResult.combina ? T.good : T.bad,
                margin: "16px 0 6px",
              }}
            >
              {matchResult.score}% de afinidade
            </div>
            <div style={{ background: T.paper2, borderRadius: 999, height: 8, margin: "0 0 16px" }}>
              <div
                style={{
                  width: `${matchResult.score}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: matchResult.combina ? T.good : T.bad,
                  transition: "width .4s ease",
                }}
              />
            </div>
            <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.5, marginBottom: 24 }}>{verdictText(matchResult)}</p>

            {matchResult.suggestions?.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: T.muted, marginBottom: 10 }}>
                  CORES DA SUA PALETA
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
                  {matchResult.suggestions.map((c, i) => (
                    <div key={c.hex + i}>
                      <div style={{ width: 46, height: 46, borderRadius: 4, background: c.hex, border: "1px solid rgba(0,0,0,0.1)" }} />
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.muted, marginTop: 4, maxWidth: 60 }}>
                        {c.nome}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={btnPrimary} onClick={() => goRoot("upload-clothing")}>
                Testar outra peça
              </button>
              <button style={btnGhost} onClick={() => goRoot("result")}>
                Ver minha paleta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
