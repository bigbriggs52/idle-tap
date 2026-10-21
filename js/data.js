// Content data: labs (map locations), floor products, tier names, tech unlock names.
window.SVT = window.SVT || {};

SVT.TIERS = [
  { from: 1, to: 5, name: "Early Computing" },
  { from: 6, to: 10, name: "8-Bit & 16-Bit Era" },
  { from: 11, to: 18, name: "Mobile Boom" },
  { from: 19, to: 25, name: "Smart Devices" },
  { from: 26, to: 30, name: "Flagship Tech" },
];

// Rotating names for the small unlock every 5 levels, one list per tier.
SVT.TECH_UNLOCKS = [
  ["Magnifier lamp", "Better soldering iron", "Anti-static mats", "Parts drawers", "Test jig", "Coffee machine", "Label printer", "Bench power supply"],
  ["Logic analyzer", "EPROM burner", "Dual monitors", "Oscilloscope", "Cartridge tester", "Assembler macros", "Ergonomic chairs", "Snack machine"],
  ["PCB CAD license", "RF shield box", "Drop-test rig", "Reflow oven", "Pick-and-place arm", "Signal generator", "Disc burner tower", "Team offsite"],
  ["CI build server", "Thermal camera", "Device farm", "Standing desks", "Benchmark suite", "Design system", "Crash reporter", "Free lunch"],
  ["Cleanroom suits", "Wafer prober", "GPU cluster", "Hinge fatigue robot", "Simulation farm", "Anechoic chamber", "Lab automation", "Nap pods"],
];

SVT.LABS = [
  {
    id: "garage", name: "Garage HQ", theme: "Consumer electronics", icon: "🔧", x: 30, y: 85,
    teams: ["Junior Techs", "Firmware Engineers", "PCB Designers", "Software Engineers", "Chip Architects"],
    products: ["Four-function calculator", "Digital wristwatch", "LED keychain game", "Pocket AM/FM radio", "Electronic organizer",
      "Dot-matrix handheld console", "CRT mini-monitor", "Dot-matrix printer", "8-bit home computer", "16-bit home console",
      "Dial-up modem", "CD-ROM drive", "Alphanumeric pager", "Flip phone", "MP3 player", "DVD player", "Point-and-shoot camera", "Color-screen slider phone",
      "Wi-Fi router", "Touchscreen smartphone", "3D graphics card", "Quad-core laptop", "Tablet", "Smartwatch", "Wireless earbuds",
      "Next-gen game console", "Folding flagship phone", "VR headset", "Autonomous delivery drone", "AI neural accelerator"],
  },
  {
    id: "arcade", name: "Arcade District", theme: "Gaming", icon: "🕹️", x: 50, y: 69,
    teams: ["Playtesters", "Cabinet Builders", "Console Engineers", "Game Devs", "Graphics Architects"],
    products: ["Paddle tennis box", "Electronic pinball board", "LCD handheld game", "Coin-op cabinet", "Light gun",
      "Cartridge console", "Arcade joystick", "Pocket monochrome handheld", "Memory card", "Polygon racing cabinet",
      "Rumble controller", "Dance mat", "Network adapter", "Color handheld", "Optical-disc console", "Gaming headset", "Motion controller", "Dual-screen handheld",
      "HD console", "Gaming mouse", "Mechanical keyboard", "Capture card", "Gaming laptop", "VR controllers", "Handheld gaming PC",
      "Cloud gaming server", "Esports arena rig", "Haptic suit", "Holographic tabletop", "AI game director"],
  },
  {
    id: "library", name: "Archive Library", theme: "Books & knowledge", icon: "📚", x: 70, y: 85,
    teams: ["Archivists", "Scanner Techs", "Database Engineers", "Search Engineers", "AI Researchers"],
    products: ["Card catalog terminal", "Microfiche reader", "Barcode wand", "Book-return sorter", "Talking dictionary",
      "Library PC", "Floppy encyclopedia", "Thermal receipt printer", "Microfilm scanner", "Audiobook cassette deck",
      "CD-ROM encyclopedia", "Flatbed scanner", "Digital audiobook player", "RFID book tag", "Self-checkout kiosk", "Pocket translator", "Laptop cart", "Smart whiteboard",
      "E-ink reader", "Book-scanning robot", "Search server", "Study tablet", "Reading-pen scanner", "Translation earpiece", "Digital archive vault",
      "Knowledge graph engine", "AR study glasses", "Robotic shelf crawler", "Universal translator", "AI tutor"],
  },
  {
    id: "maker", name: "Maker Workshop", theme: "Crafting", icon: "🛠️", x: 30, y: 53,
    teams: ["Hobbyists", "Kit Builders", "Machinists", "Robotics Makers", "Fab Engineers"],
    products: ["Soldering kit", "Breadboard", "Multimeter", "Blinking LED badge", "Hobby robot kit",
      "Microcontroller board", "LED light strip", "Vinyl cutter", "Hot-wire foam cutter", "Sewing machine controller",
      "Desktop 3D printer", "Laser engraver", "Mini CNC mill", "PCB mill", "Resin printer", "Embroidery machine", "Drone kit", "Desktop pick-and-place",
      "Multi-color 3D printer", "Laser cutter", "Robot arm kit", "Smart sewing robot", "Metal 3D printer", "Wearable LED jacket", "Automated loom",
      "Bio-plastic extruder", "Self-replicating printer", "Swarm robot kit", "Pocket fab lab", "AI design assistant"],
  },
  {
    id: "studio", name: "Sound Studio", theme: "Audio & music", icon: "🎧", x: 70, y: 53,
    teams: ["Roadies", "Audio Techs", "Sound Engineers", "DSP Developers", "Acoustic Scientists"],
    products: ["Cassette recorder", "Transistor radio", "Portable cassette player", "Boombox", "Electronic metronome",
      "Drum machine", "Analog synthesizer", "MIDI keyboard", "Sampler", "Guitar effects pedal",
      "Portable CD player", "Mixing desk", "Karaoke machine", "DAW workstation", "Studio monitors", "Digital piano", "Vocal tuner", "Hard-disk recorder",
      "Noise-cancelling headphones", "Smart speaker", "Audio interface", "Wireless mic system", "Spatial audio soundbar", "Hearing-aid earbuds", "Modular synth",
      "Concert line array", "Holographic stage rig", "Bone-conduction headset", "Neural music generator", "AI mastering engine"],
  },
  // Locations 6-30: on the map with a lock icon, marked "Coming soon".
  { id: "cinema", name: "Cinema Studios", icon: "🎬", x: 90, y: 69, soon: true },
  { id: "robotics", name: "Robotics Foundry", icon: "🤖", x: 50, y: 24, soon: true },
  { id: "auto", name: "EV Auto Plant", icon: "🚗", x: 10, y: 56, soon: true },
  { id: "space", name: "Space Port", icon: "🚀", x: 90, y: 24, soon: true },
  { id: "medtech", name: "Med-Tech Clinic", icon: "🩺", x: 50, y: 88, soon: true },
  { id: "agri", name: "AgriTech Farms", icon: "🌾", x: 10, y: 88, soon: true },
  { id: "ocean", name: "Ocean Lab", icon: "🌊", x: 90, y: 88, soon: true },
  { id: "arctic", name: "Arctic Data Center", icon: "❄️", x: 10, y: 8, soon: true },
  { id: "geo", name: "Geothermal Works", icon: "🌋", x: 70, y: 5, soon: true },
  { id: "stadium", name: "Sports Tech Stadium", icon: "🏟️", x: 90, y: 37, soon: true },
  { id: "fashion", name: "Wearables Atelier", icon: "👗", x: 70, y: 72, soon: true },
  { id: "toys", name: "Toy Factory", icon: "🧸", x: 30, y: 72, soon: true },
  { id: "home", name: "Smart Home Suburb", icon: "🏡", x: 50, y: 56, soon: true },
  { id: "drone", name: "Drone Airfield", icon: "🛩️", x: 10, y: 37, soon: true },
  { id: "cyber", name: "Cyber Security Vault", icon: "🛡️", x: 50, y: 37, soon: true },
  { id: "fintech", name: "Fintech Tower", icon: "🏦", x: 70, y: 21, soon: true },
  { id: "weather", name: "Weather Station", icon: "🌦️", x: 30, y: 21, soon: true },
  { id: "rail", name: "Maglev Rail Yard", icon: "🚄", x: 90, y: 8, soon: true },
  { id: "biotech", name: "Biotech Greenhouse", icon: "🧬", x: 70, y: 40, soon: true },
  { id: "quantum", name: "Quantum Lab", icon: "⚛️", x: 30, y: 5, soon: true },
  { id: "satellite", name: "Satellite Uplink", icon: "📡", x: 90, y: 56, soon: true },
  { id: "energy", name: "Energy Grid", icon: "⚡", x: 10, y: 69, soon: true },
  { id: "holo", name: "Holo Theater", icon: "🎭", x: 30, y: 40, soon: true },
  { id: "mars", name: "Mars Outpost", icon: "🪐", x: 50, y: 8, soon: true },
  { id: "moon", name: "Moonbase", icon: "🌙", x: 10, y: 24, soon: true },
];
