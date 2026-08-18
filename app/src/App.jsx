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
    paleta: [["#F2734F","Coral"],["#C9683F","Terracota"],["#E8A93B","Amarelo dourado"],["#8FBF4A","Verde-maçã"],["#3FB6A8","Turquesa quente"],["#E24B36","Tomate"],["#C79A5B","Camelo"],["#F0A97A","Pêssego"],["#F3E6C8","Marfim quente"],["#E8752D","Laranja"],["#E0B93C","Amarelo-ouro"],["#4FAF7A","Verde-jade quente"],["#F2957A","Salmão"],["#D9B87A","Bege dourado"]].map(([hex,nome])=>({hex,nome})),
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
    paleta: [["#D9782E","Abóbora"],["#C9A227","Mostarda"],["#708238","Verde-oliva"],["#A0522D","Ferrugem"],["#6B4226","Marrom-chocolate"],["#C9962C","Dourado"],["#B9603C","Terracota"],["#3C8A7A","Verde-azulado quente"],["#5EC7CC","Turquesa quente"],["#C9432E","Tomate"],["#C79A5B","Camelo"],["#5C6E2E","Verde-musgo"],["#7A3C2E","Vinho-terroso"],["#A87A1F","Mostarda escura"],["#C9985E","Bege-caramelo"],["#B56A3C","Cobre"],["#E0A32E","Marigold"],["#8A5A2E","Cognac"],["#3E5C2E","Verde-floresta quente"],["#7A5C2E","Bronze"],["#A66A2E","Caramelo escuro"],["#C97050","Coral terroso"],["#C97A5C","Salmão queimado"],["#A89968","Cáqui"],["#8A3B22","Marrom-avermelhado"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#E8C7D2","Rosa gelo"],["#6E8FBF","Azul frio"],["#000000","Preto"],["#FFFFFF","Branco puro"],["#C2308A","Magenta"],["#B0A0D0","Roxo-lavanda"],["#A9ABAE","Cinza-prata"],["#B8D0E8","Azul-bebê"],["#D9C9E8","Lilás claro"]].map(([hex,nome])=>({hex,nome})),
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
    paleta: [["#16130F","Preto"],["#1A2547","Azul-marinho profundo"],["#1F5C4A","Esmeralda"],["#5C1526","Vinho"],["#3E1F42","Ameixa profunda"],["#2E2E33","Chumbo"],["#A31E2E","Vermelho verdadeiro"],["#1F3E7A","Safira"],["#6B1F52","Magenta escuro"],["#123A3E","Petróleo profundo"],["#2E1433","Roxo-berinjela"],["#123D2E","Verde-esmeralda escuro"],["#3A3A3F","Cinza-grafite"],["#7A1420","Vermelho-sangue"]].map(([hex,nome])=>({hex,nome})),
    evitar: [["#F0C7A0","Pêssego pastel"],["#D9C7A8","Bege"],["#B9713C","Laranja queimado"],["#8A5A3C","Marrom quente"],["#C9962C","Dourado"],["#9AA070","Verde-oliva claro"],["#D9B87A","Camelo claro"]].map(([hex,nome])=>({hex,nome})),
  },
  "Inverno Frio": {
    estacao: "Inverno", temperatura: "fria", contraste: "alto",
    resumo: "Subtom frio e contraste alto entre pele, olhos e cabelo. Cores puras e frias — azul, fúcsia, esmeralda — favorecem mais que tons quentes ou terrosos.",
    paleta: [["#2E5CA8","Azul verdadeiro"],["#E8B8D0","Rosa gelo"],["#C2408A","Fúcsia"],["#1F8A5C","Esmeralda"],["#16130F","Preto"],["#FBFAF6","Branco puro"],["#5C2E8A","Roxo royal"],["#C21F2E","Vermelho frio"],["#A9ABAE","Cinza-prata"],["#1A2547","Azul-marinho"],["#4A2E8A","Roxo-violeta"],["#1F7A6A","Verde-jade frio"],["#C7CBD0","Cinza-gelo"],["#1F4A5C","Azul-petróleo"]].map(([hex,nome])=>({hex,nome})),
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

function perceptualDistance(rgb, color) {
  const first = rgbToLab(rgb);
  const second = rgbToLab(hexToRgb(color.hex));
  return Math.sqrt(
    (first.l - second.l) ** 2 + (first.a - second.a) ** 2 + (first.b - second.b) ** 2,
  );
}

function closestColor(rgb, colors, source) {
  return colors.reduce((closest, color) => {
    const d = perceptualDistance(rgb, color);
    return !closest || d < closest.d ? { d, color, source } : closest;
  }, null);
}

function matchClothing(dominantRgb, season) {
  const presetPalette = SEASON_PRESETS[season.subtom]?.paleta || [];
  const primaryPalette = [...(season.paleta || []), ...presetPalette].filter(
    (color, index, list) => list.findIndex((item) => item.hex === color.hex) === index,
  );
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

/* ---------- swatch fan ---------- */
function Fan({ colors, small }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
      {colors.map((c, i) => (
        <div
          key={c.hex + i}
          style={{
            width: small ? 58 : 74,
            transform: `rotate(${i % 2 === 0 ? -3 : 3}deg) translateY(${i % 3 === 0 ? 0 : 6}px)`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: small ? 58 : 90,
              background: c.hex,
              borderRadius: "10px 10px 3px 3px",
              boxShadow: "0 4px 10px rgba(34,30,26,0.18)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          />
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: T.muted,
              textAlign: "center",
              marginTop: 4,
              letterSpacing: 0.3,
            }}
          >
            {c.hex.toUpperCase()}
          </div>
        </div>
      ))}
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
  const [season, setSeason] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [matchResult, setMatchResult] = useState(null);
  const [clothingPreview, setClothingPreview] = useState(null);
  const [tapImage, setTapImage] = useState(null);
  const [tapPoint, setTapPoint] = useState(null);

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
          setSeason(JSON.parse(saved));
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
      setSeason(parsed);
      try {
        window.localStorage.setItem("coloracao:resultado", JSON.stringify(parsed));
      } catch (e) {}
      setStep("result");
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
      setTapImage(resized);
      setTapPoint(null);
      setStep("pick-point");
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
    const rgb = { r: median("r"), g: median("g"), b: median("b") };
    setTapPoint({ xPct: xRatio * 100, yPct: yRatio * 100, rgb });
  }

  function confirmTapPoint() {
    if (!tapPoint || !tapImage) return;
    const result = matchClothing(tapPoint.rgb, season);
    setMatchResult(result);
    setClothingPreview(tapImage.dataUrl);
    setStep("match-result");
  }

  async function selectPreset(name) {
    const preset = SEASON_PRESETS[name];
    const full = { subtom: name, ...preset };
    setSeason(full);
    try {
      window.localStorage.setItem("coloracao:resultado", JSON.stringify(full));
    } catch (e) {}
    setStep("result");
  }

  async function resetAll() {
    try {
      window.localStorage.removeItem("coloracao:resultado");
    } catch (e) {}
    setSeason(null);
    setMatchResult(null);
    setClothingPreview(null);
    setStep("upload-face");
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

  return (
    <div style={wrap}>
      <div style={card}>
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
              <Fan
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
              <button style={btnPrimary} onClick={() => setStep("upload-face")}>
                Descobrir minha coloração
              </button>
              <button style={btnGhost} onClick={() => setStep("select-manual")}>
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
              onClick={() => setStep("select-manual")}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.subtons.map((name) => (
                    <button
                      key={name}
                      onClick={() => selectPreset(name)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        textAlign: "left",
                        background: T.paper2,
                        border: `1px solid ${T.line}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        cursor: "pointer",
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 14,
                        color: T.ink,
                      }}
                    >
                      <span style={{ display: "flex", gap: -4 }}>
                        {SEASON_PRESETS[name].paleta.slice(0, 4).map((c, i) => (
                          <span
                            key={i}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: c.hex,
                              marginLeft: i === 0 ? 0 : -6,
                              border: "1.5px solid " + T.paper2,
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
            <button style={{ ...btnGhost, marginTop: 4 }} onClick={() => setStep("intro")}>
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
              SUA PALETA
            </div>
            <Fan colors={season.paleta} />

            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: T.muted, margin: "28px 0 12px" }}>
              EVITAR
            </div>
            <Fan colors={season.evitar} small />

            {SISTER_MAP[season.subtom] && SEASON_PRESETS[SISTER_MAP[season.subtom]] && (
              <>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: T.muted, margin: "28px 0 4px" }}>
                  CARTELA IRMÃ · {SISTER_MAP[season.subtom].toUpperCase()}
                </div>
                <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5, marginBottom: 12 }}>
                  Compartilha a característica principal com a sua. Se tiver uma peça amada fora da sua cartela, essas
                  cores extras também costumam funcionar.
                </p>
                <Fan colors={SEASON_PRESETS[SISTER_MAP[season.subtom]].paleta} small />
              </>
            )}

            <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={btnPrimary} onClick={() => setStep("upload-clothing")}>
                Testar uma roupa
              </button>
              <button style={btnGhost} onClick={resetAll}>
                Refazer análise por foto
              </button>
              <button
                style={{ ...btnGhost, border: "none", color: T.muted, textDecoration: "underline" }}
                onClick={() => setStep("select-manual")}
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
            <button style={{ ...btnGhost, marginTop: 16 }} onClick={() => setStep("result")}>
              Voltar pra minha paleta
            </button>
          </div>
        )}

        {step === "pick-point" && tapImage && (
          <div>
            <div style={eyebrow}>toque na peça</div>
            <h1 style={{ ...h1, fontSize: 26, marginBottom: 8 }}>Onde está a roupa?</h1>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Toque exatamente em cima do tecido da peça na foto.
            </p>
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", lineHeight: 0 }}>
              <img
                src={tapImage.dataUrl}
                alt="foto enviada"
                onClick={handleImageTap}
                style={{ width: "100%", display: "block", cursor: "crosshair" }}
              />
              {tapPoint && (
                <div
                  style={{
                    position: "absolute",
                    left: `${tapPoint.xPct}%`,
                    top: `${tapPoint.yPct}%`,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    transform: "translate(-50%,-50%)",
                    border: "3px solid #fff",
                    boxShadow: "0 0 0 2px rgba(0,0,0,0.35), 0 2px 10px rgba(0,0,0,0.4)",
                    background: rgbToHex(tapPoint.rgb),
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            {tapPoint ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: rgbToHex(tapPoint.rgb), border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: T.muted }}>cor capturada — toque em outro ponto pra ajustar</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: T.muted, marginTop: 14 }}>nenhum ponto tocado ainda</div>
            )}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={btnPrimary} disabled={!tapPoint} onClick={confirmTapPoint}>
                Usar essa cor
              </button>
              <button style={btnGhost} onClick={() => setStep("upload-clothing")}>
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
                style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 14, margin: "14px auto", boxShadow: "0 6px 16px rgba(0,0,0,0.15)" }}
              />
            )}
            <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
              <div>
                <div style={{ width: 46, height: 46, borderRadius: 10, background: matchResult.dominantHex, border: "1px solid rgba(0,0,0,0.1)", margin: "0 auto" }} />
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
                      <div style={{ width: 46, height: 46, borderRadius: 10, background: c.hex, border: "1px solid rgba(0,0,0,0.1)" }} />
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.muted, marginTop: 4, maxWidth: 60 }}>
                        {c.nome}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button style={btnPrimary} onClick={() => setStep("upload-clothing")}>
                Testar outra peça
              </button>
              <button style={btnGhost} onClick={() => setStep("result")}>
                Ver minha paleta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
