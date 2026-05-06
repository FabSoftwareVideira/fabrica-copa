// =====================================================
// DATA - Álbum Copa do Mundo FIFA 2026
// =====================================================

const ALBUM_DATA = {
    title: "Copa do Mundo FIFA 2026",
    subtitle: "EUA • Canadá • México",
    totalExpected: 298,

    // Seção de figurinhas especiais
    special: {
        id: "especial",
        name: "Especial",
        color: "#FFD700",
        stickers: [
            { num: 1, name: "Capa do Álbum", type: "cover", icon: "📖" },
            { num: 2, name: "Troféu FIFA World Cup", type: "trophy", icon: "🏆" },
            { num: 3, name: "Talisma Oficial", type: "mascot", icon: "🎭" },
            { num: 4, name: "Bola Oficial", type: "ball", icon: "⚽" },
            { num: 5, name: "Sede: Nova York / NJ", type: "stadium", icon: "🏟️" },
            { num: 6, name: "Sede: Los Angeles", type: "stadium", icon: "🏟️" },
            { num: 7, name: "Sede: Dallas", type: "stadium", icon: "🏟️" },
            { num: 8, name: "Sede: Cidade do México", type: "stadium", icon: "🏟️" },
            { num: 9, name: "Sede: Toronto", type: "stadium", icon: "🏟️" },
            { num: 10, name: "Sede: Vancouver", type: "stadium", icon: "🏟️" },
        ]
    },

    // Grupos e times
    groups: [
        {
            id: "A", name: "Grupo A", color: "#e74c3c",
            startNum: 11,
            teams: [
                {
                    id: "usa", name: "Estados Unidos", flag: "🇺🇸", abbr: "EUA",
                    players: ["Christian Pulisic", "Tyler Adams", "Weston McKennie", "Gio Reyna", "Matt Turner"]
                },
                {
                    id: "mar", name: "Marrocos", flag: "🇲🇦", abbr: "MAR",
                    players: ["Achraf Hakimi", "Hakim Ziyech", "Youssef En-Nesyri", "Sofyan Amrabat", "Bono"]
                },
                {
                    id: "sui", name: "Suíça", flag: "🇨🇭", abbr: "SUI",
                    players: ["Granit Xhaka", "Xherdan Shaqiri", "Yann Sommer", "Manuel Akanji", "Rubén Vargas"]
                },
                {
                    id: "jor", name: "Jordânia", flag: "🇯🇴", abbr: "JOR",
                    players: ["Musa Al-Tamari", "Yazan Al-Naimat", "Ahmad Salam", "Mahmoud Rashid", "Shadi Shaheen"]
                }
            ]
        },
        {
            id: "B", name: "Grupo B", color: "#e67e22",
            startNum: 37,
            teams: [
                {
                    id: "mex", name: "México", flag: "🇲🇽", abbr: "MEX",
                    players: ["Hirving Lozano", "Edson Álvarez", "Raúl Jiménez", "Guillermo Ochoa", "Alexis Vega"]
                },
                {
                    id: "ksa", name: "Arábia Saudita", flag: "🇸🇦", abbr: "KSA",
                    players: ["Salem Al-Dawsari", "Mohammed Al-Owais", "Firas Al-Buraikan", "Sami Al-Najei", "Ali Al-Bulaihi"]
                },
                {
                    id: "den", name: "Dinamarca", flag: "🇩🇰", abbr: "DEN",
                    players: ["Christian Eriksen", "Kasper Schmeichel", "Simon Kjær", "Andreas Christensen", "Rasmus Højlund"]
                },
                {
                    id: "sen", name: "Senegal", flag: "🇸🇳", abbr: "SEN",
                    players: ["Sadio Mané", "Édouard Mendy", "Kalidou Koulibaly", "Idrissa Gueye", "Ismaïla Sarr"]
                }
            ]
        },
        {
            id: "C", name: "Grupo C", color: "#f1c40f",
            startNum: 63,
            teams: [
                {
                    id: "can", name: "Canadá", flag: "🇨🇦", abbr: "CAN",
                    players: ["Alphonso Davies", "Jonathan David", "Tajon Buchanan", "Cyle Larin", "Milan Borjan"]
                },
                {
                    id: "aus", name: "Austrália", flag: "🇦🇺", abbr: "AUS",
                    players: ["Mitchell Duke", "Aaron Mooy", "Mat Ryan", "Martin Boyle", "Mathew Leckie"]
                },
                {
                    id: "cro", name: "Croácia", flag: "🇭🇷", abbr: "CRO",
                    players: ["Luka Modrić", "Mateo Kovačić", "Ivan Perišić", "Dominik Livaković", "Marcelo Brozović"]
                },
                {
                    id: "per", name: "Peru", flag: "🇵🇪", abbr: "PER",
                    players: ["Paolo Guerrero", "André Carrillo", "Jefferson Farfán", "Gianluca Lapadula", "Pedro Gallese"]
                }
            ]
        },
        {
            id: "D", name: "Grupo D", color: "#2ecc71",
            startNum: 89,
            teams: [
                {
                    id: "bra", name: "Brasil", flag: "🇧🇷", abbr: "BRA",
                    players: ["Vinícius Jr.", "Rodrygo", "Casemiro", "Marquinhos", "Alisson"]
                },
                {
                    id: "kor", name: "Coreia do Sul", flag: "🇰🇷", abbr: "KOR",
                    players: ["Son Heung-min", "Kim Min-jae", "Lee Kang-in", "Hwang Hee-chan", "Kim Seung-gyu"]
                },
                {
                    id: "sco", name: "Escócia", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", abbr: "SCO",
                    players: ["Andy Robertson", "Scott McTominay", "Kieran Tierney", "John McGinn", "David Marshall"]
                },
                {
                    id: "civ", name: "Costa do Marfim", flag: "🇨🇮", abbr: "CIV",
                    players: ["Sébastien Haller", "Franck Kessié", "Simon Adingra", "Eric Bailly", "Yahia Fofana"]
                }
            ]
        },
        {
            id: "E", name: "Grupo E", color: "#1abc9c",
            startNum: 115,
            teams: [
                {
                    id: "arg", name: "Argentina", flag: "🇦🇷", abbr: "ARG",
                    players: ["Lionel Messi", "Julián Álvarez", "Rodrigo De Paul", "Enzo Fernández", "Emiliano Martínez"]
                },
                {
                    id: "jpn", name: "Japão", flag: "🇯🇵", abbr: "JPN",
                    players: ["Takumi Minamino", "Kaoru Mitoma", "Takehiro Tomiyasu", "Maya Yoshida", "Shuichi Gonda"]
                },
                {
                    id: "tur", name: "Turquia", flag: "🇹🇷", abbr: "TUR",
                    players: ["Hakan Çalhanoğlu", "Arda Güler", "Kenan Yıldız", "Çağlar Söyüncü", "Mert Günok"]
                },
                {
                    id: "nga", name: "Nigéria", flag: "🇳🇬", abbr: "NGA",
                    players: ["Victor Osimhen", "Wilfred Ndidi", "Samuel Chukwueze", "Ademola Lookman", "Stanley Nwabali"]
                }
            ]
        },
        {
            id: "F", name: "Grupo F", color: "#3498db",
            startNum: 141,
            teams: [
                {
                    id: "fra", name: "França", flag: "🇫🇷", abbr: "FRA",
                    players: ["Kylian Mbappé", "Antoine Griezmann", "Aurélien Tchouaméni", "Ousmane Dembélé", "Mike Maignan"]
                },
                {
                    id: "col", name: "Colômbia", flag: "🇨🇴", abbr: "COL",
                    players: ["James Rodríguez", "Luis Díaz", "Falcao", "Davinson Sánchez", "Camilo Vargas"]
                },
                {
                    id: "aut", name: "Áustria", flag: "🇦🇹", abbr: "AUT",
                    players: ["David Alaba", "Marcel Sabitzer", "Marko Arnautovic", "Florian Grillitsch", "Patrick Pentz"]
                },
                {
                    id: "irq", name: "Iraque", flag: "🇮🇶", abbr: "IRQ",
                    players: ["Aymen Hussein", "Amjad Attwan", "Bashar Resan", "Mohanad Ali", "Jalal Hassan"]
                }
            ]
        },
        {
            id: "G", name: "Grupo G", color: "#9b59b6",
            startNum: 167,
            teams: [
                {
                    id: "ger", name: "Alemanha", flag: "🇩🇪", abbr: "GER",
                    players: ["Florian Wirtz", "Jamal Musiala", "Thomas Müller", "Manuel Neuer", "Toni Kroos"]
                },
                {
                    id: "ecu", name: "Equador", flag: "🇪🇨", abbr: "ECU",
                    players: ["Enner Valencia", "Moisés Caicedo", "Pervis Estupiñán", "Gonzalo Plata", "Hernán Galíndez"]
                },
                {
                    id: "egy", name: "Egito", flag: "🇪🇬", abbr: "EGY",
                    players: ["Mohamed Salah", "Ahmed El-Shenawy", "Mohamed Elneny", "Trezeguet", "Omar Marmoush"]
                },
                {
                    id: "rou", name: "Romênia", flag: "🇷🇴", abbr: "ROU",
                    players: ["Ianis Hagi", "Nicolae Stanciu", "Denis Drăguș", "Florin Tătărușanu", "Radu Drăgușin"]
                }
            ]
        },
        {
            id: "H", name: "Grupo H", color: "#e91e63",
            startNum: 193,
            teams: [
                {
                    id: "esp", name: "Espanha", flag: "🇪🇸", abbr: "ESP",
                    players: ["Pedri", "Gavi", "Rodri", "Lamine Yamal", "Unai Simón"]
                },
                {
                    id: "ven", name: "Venezuela", flag: "🇻🇪", abbr: "VEN",
                    players: ["Salomón Rondón", "Tomás Rincón", "Jhon Chancellor", "Josef Martínez", "Wuilker Faríñez"]
                },
                {
                    id: "srb", name: "Sérvia", flag: "🇷🇸", abbr: "SRB",
                    players: ["Dušan Vlahović", "Aleksandar Mitrović", "Sergej Milinković-Savić", "Predrag Rajković", "Dušan Tadić"]
                },
                {
                    id: "dza", name: "Argélia", flag: "🇩🇿", abbr: "DZA",
                    players: ["Riyad Mahrez", "Islam Slimani", "Ismaël Bennacer", "Andy Delort", "Rais M'Bolhi"]
                }
            ]
        },
        {
            id: "I", name: "Grupo I", color: "#00bcd4",
            startNum: 219,
            teams: [
                {
                    id: "eng", name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", abbr: "ENG",
                    players: ["Jude Bellingham", "Harry Kane", "Bukayo Saka", "Phil Foden", "Jordan Pickford"]
                },
                {
                    id: "irn", name: "Irã", flag: "🇮🇷", abbr: "IRN",
                    players: ["Mehdi Taremi", "Sardar Azmoun", "Alireza Jahanbakhsh", "Alireza Beiranvand", "Karim Ansarifard"]
                },
                {
                    id: "pol", name: "Polônia", flag: "🇵🇱", abbr: "POL",
                    players: ["Robert Lewandowski", "Piotr Zieliński", "Wojciech Szczęsny", "Jakub Moder", "Arkadiusz Milik"]
                },
                {
                    id: "gha", name: "Gana", flag: "🇬🇭", abbr: "GHA",
                    players: ["Mohammed Kudus", "Thomas Partey", "Jordan Ayew", "André Ayew", "Lawrence Ati-Zigi"]
                }
            ]
        },
        {
            id: "J", name: "Grupo J", color: "#ff5722",
            startNum: 245,
            teams: [
                {
                    id: "por", name: "Portugal", flag: "🇵🇹", abbr: "POR",
                    players: ["Cristiano Ronaldo", "Bruno Fernandes", "Rafael Leão", "Rúben Dias", "Diogo Costa"]
                },
                {
                    id: "uru", name: "Uruguai", flag: "🇺🇾", abbr: "URU",
                    players: ["Federico Valverde", "Darwin Núñez", "Luis Suárez", "José María Giménez", "Fernando Muslera"]
                },
                {
                    id: "ned", name: "Países Baixos", flag: "🇳🇱", abbr: "NED",
                    players: ["Virgil van Dijk", "Memphis Depay", "Frenkie de Jong", "Cody Gakpo", "Bart Verbruggen"]
                },
                {
                    id: "rsa", name: "África do Sul", flag: "🇿🇦", abbr: "RSA",
                    players: ["Percy Tau", "Bongani Zungu", "Ronwen Williams", "Lyle Foster", "Themba Zwane"]
                }
            ]
        },
        {
            id: "K", name: "Grupo K", color: "#607d8b",
            startNum: 271,
            teams: [
                {
                    id: "ita", name: "Itália", flag: "🇮🇹", abbr: "ITA",
                    players: ["Gianluigi Donnarumma", "Federico Chiesa", "Nicolo Barella", "Ciro Immobile", "Marco Verratti"]
                },
                {
                    id: "bel", name: "Bélgica", flag: "🇧🇪", abbr: "BEL",
                    players: ["Kevin De Bruyne", "Romelu Lukaku", "Thibaut Courtois", "Axel Witsel", "Toby Alderweireld"]
                },
                {
                    id: "pan", name: "Panamá", flag: "🇵🇦", abbr: "PAN",
                    players: ["Ismael Díaz", "Adalberto Carrasquilla", "Aníbal Godoy", "Orlando Mosquera", "José Fajardo"]
                },
                {
                    id: "uzb", name: "Uzbequistão", flag: "🇺🇿", abbr: "UZB",
                    players: ["Eldor Shomurodov", "Abbosbek Fayzullaev", "Jaloliddin Masharipov", "Dilshodbek Hamrobekov", "Otabek Shukurov"]
                }
            ]
        },
        {
            id: "L", name: "Grupo L", color: "#795548",
            startNum: 297,
            teams: [
                {
                    id: "hon", name: "Honduras", flag: "🇭🇳", abbr: "HON",
                    players: ["Anthony Lozano", "Romell Quioto", "Maynor Figueroa", "Luis Palma", "Harold Fonseca"]
                },
                {
                    id: "jam", name: "Jamaica", flag: "🇯🇲", abbr: "JAM",
                    players: ["Leon Bailey", "Michail Antonio", "Bobby Reid", "Shamar Nicholson", "Andre Blake"]
                },
                {
                    id: "cmr", name: "Camarões", flag: "🇨🇲", abbr: "CMR",
                    players: ["André Onana", "Eric Maxim Choupo-Moting", "Bryan Mbeumo", "Vincent Aboubakar", "Nicolas Nkoulou"]
                },
                {
                    id: "nzl", name: "Nova Zelândia", flag: "🇳🇿", abbr: "NZL",
                    players: ["Chris Wood", "Winston Reid", "Clayton Lewis", "Stefan Marinovic", "Liberato Cacace"]
                }
            ]
        }
    ]
};

// Gera a lista plana de todas as figurinhas
function generateAllStickers() {
    const stickers = [];
    let num = 1;

    // Figurinhas especiais
    ALBUM_DATA.special.stickers.forEach(s => {
        stickers.push({
            id: `esp-${s.num}`,
            num: s.num,
            name: s.name,
            section: "especial",
            sectionName: "Especial",
            type: s.type,
            icon: s.icon,
            teamId: null,
            teamName: null,
            groupId: null,
        });
        num++;
    });

    // Figurinhas por grupo
    ALBUM_DATA.groups.forEach(group => {
        let stickerNum = group.startNum;

        // Figurinhas dos times
        group.teams.forEach(team => {
            // Escudo
            stickers.push({
                id: `${team.id}-badge`,
                num: stickerNum++,
                name: `${team.name} - Escudo`,
                section: `grupo-${group.id}`,
                sectionName: group.name,
                type: "badge",
                icon: team.flag,
                teamId: team.id,
                teamName: team.name,
                groupId: group.id,
            });

            // Jogadores
            team.players.forEach((player, i) => {
                stickers.push({
                    id: `${team.id}-p${i + 1}`,
                    num: stickerNum++,
                    name: player,
                    section: `grupo-${group.id}`,
                    sectionName: group.name,
                    type: "player",
                    icon: team.flag,
                    teamId: team.id,
                    teamName: team.name,
                    groupId: group.id,
                });
            });
        });
    });

    return stickers;
}

const ALL_STICKERS = generateAllStickers();

if (typeof window !== "undefined") {
    window.ALBUM_DATA = ALBUM_DATA;
    window.ALL_STICKERS = ALL_STICKERS;
}
