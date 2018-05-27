export const normal = 0x0, fight = 0x1, flying = 0x2, poison = 0x3, ground = 0x4,
	   rock = 0x5, bug = 0x6, ghost = 0x7, steel = 0x8, fire = 0x9, water = 0xA,
	   grass = 0xB, electric = 0xC, psychic = 0xD, ice = 0xE, dragon = 0xF, dark = 0x10;

export const getTypeByName = function(name) {
	const table = { normal, fight, flying, poison, ground, rock, bug, ghost,
		steel, fire, water, grass, electric, psychic, ice, dragon, dark };
	return table[name.toLowerCase().trim()];
};
