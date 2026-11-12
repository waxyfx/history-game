#pragma once
namespace tj {
// Item ids 1..ItemCount. Names/descriptions shown in the UI are localised in JS (src/rpg/i18n.js);
// the Kazakh strings here are kept for the stable tj_item_text ABI.
constexpr int ItemCount=14;
enum ItemType { WeaponItem,AmmoItem,ConsumableItem,HistoricalItem,KeyItem,ArtifactItem };
enum ItemId { ISword=1,ISpear,IBow,IArrows,IKit,ITool,ITorch,IPage,IHerb,IQuiver,IOchre,IFlute,ICrystal,INecklace };
struct ItemDef {const char* id;const char* name;const char* description;int type,limit;};
constexpr ItemDef items[]={
 {"sword","Қылыш","Шежіре институтының жеңіл жүзі. Кең әрі жылдам соққы.",WeaponItem,1},
 {"spear","Найза","Тас ұшты найза. Ұзын әрі тар соққы.",WeaponItem,1},
 {"bow","Садақ","Қашықтықтан ату. Әр жебе жұмсалады.",WeaponItem,1},
 {"arrows","Жебелер","Шақпақтас ұшты жебелер.",AmmoItem,40},
 {"field-kit","Көмек қобдишасы","2087 жылғы дәрі қобдишасы: +45 денсаулық.",ConsumableItem,5},
 {"stone-tool","Тас құрал","Шақпақтың шапқы құралы.",HistoricalItem,1},
 {"torch","Алау","Үңгірдің қараңғысын жарықтандырады.",KeyItem,1},
 {"chronicle-page","Шежіре парағы","Шежіре парағының үзіндісі.",ArtifactItem,3},
 {"herbs","Емдік шөп","Жусан мен түймедақ: +20 денсаулық.",ConsumableItem,9},
 {"quiver","Жебейдің қорамсағы","Жоғалған аңшының қорамсағы.",KeyItem,1},
 {"ochre","Жосa","Жартас суретіне қолданылған қызыл бояу.",ArtifactItem,1},
 {"flute","Сүйек сыбызғы","Үңгірде жасырылған сүйек сыбызғы.",ArtifactItem,1},
 {"crystal","Бөтен кристалл","Бұл дәуірге жатпайтын күлгін сынық.",KeyItem,3},
 {"necklace","Тіс алқа","Аңшылардың сыйы — сенім белгісі.",ArtifactItem,1}
};
struct Inventory {int counts[ItemCount]={1,0,0,0,1,0,0,0,0,0,0,0,0,0};};
}
