import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ═══ ENGINE ═══
const gc = i => [0,3,6,9].includes(i) ? 'support' : [1,4,7,10].includes(i) ? 'right' : 'left';
const gp = i => ['she','fo','tsi','ha'][i % 4];
const gt = i => i % 2 === 0 ? 'long' : 'short';
const opp = i => (i + 6) % 12;
const mirrorStruggle = [6,5,4,3,2,1,0,11,10,9,8,7];
const mirrorUnity = [0,11,10,9,8,7,6,5,4,3,2,1];

const CROSSES = {
  support: { id: 'support', name: 'Опорный', virtue: 'Надежда', positions: [0,3,6,9], role: 'Основа/Бой', extra: {0:'Тайный союз',3:'Война',6:'Явный союз',9:'Мир'} },
  right: { id: 'right', name: 'Правый', virtue: 'Любовь', positions: [1,4,7,10], role: 'Исход/Победа' },
  left: { id: 'left', name: 'Левый', virtue: 'Вера', positions: [2,5,8,11], role: 'Подготовка/Вера' },
};

const PRANAS = {
  she: { id: 'she', name: 'ШЭ', element: 'Земля', quality: 'Устойчивость', positions: [0,4,8] },
  fo: { id: 'fo', name: 'ФО', element: 'Вода', quality: 'Спад', positions: [1,5,9] },
  tsi: { id: 'tsi', name: 'ЦИ', element: 'Воздух', quality: 'Неустойчивый покой', positions: [2,6,10] },
  ha: { id: 'ha', name: 'ХА', element: 'Огонь', quality: 'Рост', positions: [3,7,11] },
};

app.get('/api/engine/position/:i', (req, res) => {
  const i = parseInt(req.params.i);
  if (isNaN(i) || i < 0 || i > 11) return res.status(400).json({ error: 'Position 0-11' });
  const cross = CROSSES[gc(i)];
  const prana = PRANAS[gp(i)];
  res.json({
    index: i,
    type: gt(i),
    cross: { id: cross.id, name: cross.name, virtue: cross.virtue, role: cross.role },
    prana: { id: prana.id, name: prana.name, element: prana.element, quality: prana.quality },
    fullOpposition: opp(i),
    halfOppositionStruggle: mirrorStruggle[i],
    halfOppositionUnity: mirrorUnity[i],
    angleDeg: (270 - i * 30 + 360) % 360,
  });
});

app.get('/api/engine/crosses', (req, res) => res.json(CROSSES));
app.get('/api/engine/pranas', (req, res) => res.json(PRANAS));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Yasna API: http://localhost:${PORT}`));
