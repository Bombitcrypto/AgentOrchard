// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentOrchard
 * @notice Noncustodial orchard game gated by official Agent ID on BNB Chain. No app fees, escrow, admin or upgradeability.
 * @dev Each state-changing call still consumes native BNB network gas paid by tx sender.
 *      Uses UTC blockchain days. No ERC20, financial returns or tradable fruit.
 */
interface IOrchardAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

/** @dev Simple dependency-free Base64 encoder for on-chain NFT image and metadata. */
library OrchardBase64 {
    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        bytes memory table = bytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
        bytes memory result = new bytes(4 * ((data.length + 2) / 3));
        uint256 j = 0;
        for (uint256 i = 0; i < data.length; i += 3) {
            uint256 x = uint256(uint8(data[i])) << 16;
            if (i + 1 < data.length) x |= uint256(uint8(data[i+1])) << 8;
            if (i + 2 < data.length) x |= uint256(uint8(data[i+2]));
            result[j++] = table[(x >> 18) & 63];
            result[j++] = table[(x >> 12) & 63];
            result[j++] = i + 1 < data.length ? table[(x >> 6) & 63] : bytes1("=");
            result[j++] = i + 2 < data.length ? table[x & 63] : bytes1("=");
        }
        return string(result);
    }
}

contract AgentOrchard {
    IOrchardAgentID public constant agentId = IOrchardAgentID(0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);
    uint256 private constant MAX_TREES_PER_AGENT = 100;
    uint256 public nextTreeId = 1;
    uint256 public nextBadgeTokenId = 1;
    uint256 public totalCheckIns;
    uint256 public totalHarvests;

    struct Farmer {
        uint32 streak;
        uint32 bestStreak;
        uint32 totalDays;
        uint32 water;
        uint32 sunlight;
        uint32 seeds;
        uint32 apples;
        uint32 oranges;
        uint32 mangoes;
        uint32 xp;
        uint64 lastCheckinDay;
    }
    struct Tree {
        address farmer;
        uint64 plantedDay;
        uint64 lastTendedDay;
        uint8 species; // 0 = apple, 1 = orange, 2 = mango
        uint8 care;
        bool harvested;
    }
    mapping(address => Farmer) public farmers;
    mapping(uint256 => Tree) public trees;
    mapping(address => uint256[]) private _ownedTrees;
    mapping(address => mapping(uint8 => bool)) public earnedBadges;

    // Minimal non-transferable ERC-721 badge. It intentionally does not implement approvals or transfers.
    mapping(uint256 => address) private _badgeOwner;
    mapping(address => uint256) private _badgeBalance;
    mapping(uint256 => uint8) public badgeTier;

    error AgentIDRequired();
    error OneCheckinPerDay();
    error CheckinFirst();
    error NeedSeed();
    error NeedResources();
    error UnknownTree();
    error NotYourTree();
    error AlreadyTended();
    error TreeNotReady();
    error TooManyTrees();
    error BadSpecies();
    error BadBadgeTier();
    error StreakTooShort();
    error AlreadyMinted();
    error Soulbound();
    error InvalidAddress();

    event CheckIn(address indexed farmer, uint256 indexed day, uint32 streak, uint32 water, uint32 sunlight, uint32 seeds);
    event TreePlanted(address indexed farmer, uint256 indexed treeId, uint8 species);
    event TreeTended(address indexed farmer, uint256 indexed treeId, uint8 care);
    event FruitHarvested(address indexed farmer, uint256 indexed treeId, uint8 species, uint32 xp);
    event BadgeMinted(address indexed farmer, uint256 indexed tokenId, uint8 tier);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    // ERC-5192: each streak NFT is locked permanently (soulbound).
    event Locked(uint256 tokenId);

    modifier onlyAgent() {
        if (agentId.balanceOf(msg.sender) == 0) revert AgentIDRequired();
        _;
    }

    function today() public view returns (uint256) { return block.timestamp / 1 days; }

    function checkIn() external onlyAgent {
        Farmer storage f = farmers[msg.sender];
        uint256 day = today();
        if (f.totalDays > 0 && f.lastCheckinDay == day) revert OneCheckinPerDay();
        f.streak = (f.totalDays > 0 && uint256(f.lastCheckinDay) + 1 == day) ? f.streak + 1 : 1;
        f.totalDays += 1;
        if (f.streak > f.bestStreak) f.bestStreak = f.streak;
        f.lastCheckinDay = uint64(day);
        f.water += 1;
        f.sunlight += 1;
        if (f.totalDays == 1 || f.streak % 3 == 0) f.seeds += 1;
        f.xp += 10;
        totalCheckIns += 1;
        emit CheckIn(msg.sender, day, f.streak, f.water, f.sunlight, f.seeds);
    }

    function plant(uint8 species) external onlyAgent returns (uint256 id) {
        if (species > 2) revert BadSpecies();
        Farmer storage f = farmers[msg.sender];
        if (f.totalDays == 0) revert CheckinFirst();
        if (f.seeds == 0) revert NeedSeed();
        if (_ownedTrees[msg.sender].length >= MAX_TREES_PER_AGENT) revert TooManyTrees();
        f.seeds -= 1;
        id = nextTreeId++;
        trees[id] = Tree(msg.sender, uint64(today()), 0, species, 0, false);
        _ownedTrees[msg.sender].push(id);
        f.xp += 15;
        emit TreePlanted(msg.sender, id, species);
    }

    function tend(uint256 treeId) external onlyAgent {
        Tree storage t = trees[treeId];
        if (t.farmer == address(0)) revert UnknownTree();
        if (t.farmer != msg.sender) revert NotYourTree();
        if (t.harvested || t.care >= 3) revert TreeNotReady();
        uint256 day = today();
        if (t.lastTendedDay == day) revert AlreadyTended();
        Farmer storage f = farmers[msg.sender];
        if (f.water == 0 || f.sunlight == 0) revert NeedResources();
        f.water -= 1;
        f.sunlight -= 1;
        t.care += 1;
        t.lastTendedDay = uint64(day);
        f.xp += 20;
        emit TreeTended(msg.sender, treeId, t.care);
    }

    function harvest(uint256 treeId) external onlyAgent {
        Tree storage t = trees[treeId];
        if (t.farmer == address(0)) revert UnknownTree();
        if (t.farmer != msg.sender) revert NotYourTree();
        if (t.harvested || t.care < 3 || today() < uint256(t.plantedDay) + 2) revert TreeNotReady();
        t.harvested = true;
        Farmer storage f = farmers[msg.sender];
        if (t.species == 0) f.apples += 3;
        if (t.species == 1) f.oranges += 3;
        if (t.species == 2) f.mangoes += 3;
        f.xp += 50;
        totalHarvests += 1;
        emit FruitHarvested(msg.sender, treeId, t.species, f.xp);
    }

    function mintBadge(uint8 tier) external onlyAgent returns (uint256 tokenId) {
        if (tier < 1 || tier > 3) revert BadBadgeTier();
        Farmer storage f = farmers[msg.sender];
        uint256 requiredStreak = tier == 1 ? 3 : tier == 2 ? 7 : 14;
        // A streak expires only after a full missed UTC day, not at day rollover.
        if (f.streak < requiredStreak || uint256(f.lastCheckinDay) + 1 < today()) revert StreakTooShort();
        if (earnedBadges[msg.sender][tier]) revert AlreadyMinted();
        earnedBadges[msg.sender][tier] = true;
        tokenId = nextBadgeTokenId++;
        _badgeOwner[tokenId] = msg.sender;
        _badgeBalance[msg.sender] += 1;
        badgeTier[tokenId] = tier;
        f.xp += tier == 1 ? 50 : tier == 2 ? 120 : 300;
        emit Transfer(address(0), msg.sender, tokenId);
        emit Locked(tokenId);
        emit BadgeMinted(msg.sender, tokenId, tier);
    }

    function getTrees(address farmer) external view returns (uint256[] memory) { return _ownedTrees[farmer]; }
    function isAgent(address wallet) external view returns (bool) { return agentId.balanceOf(wallet) > 0; }

    function name() external pure returns (string memory) { return "Agent Orchard Streak Badges"; }
    function symbol() external pure returns (string memory) { return "ORCHARD"; }
    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert InvalidAddress();
        return _badgeBalance[owner];
    }
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _badgeOwner[tokenId];
        if (owner == address(0)) revert InvalidAddress();
        return owner;
    }
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        uint8 tier = badgeTier[tokenId];
        string memory label = tier == 1 ? "First Roots" : tier == 2 ? "Steady Grower" : "Orchard Legend";
        string memory daysLabel = tier == 1 ? "3" : tier == 2 ? "7" : "14";
        string memory hue = tier == 1 ? "#d19c67" : tier == 2 ? "#a7c8a8" : "#f1ce6e";
        // Fully on-chain, permanent SVG and JSON. No private IPFS gateway or placeholder URI.
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">',
            '<rect width="500" height="500" fill="#122319"/><rect x="36" y="36" width="428" height="428" rx="26" fill="#223829" stroke="', hue, '" stroke-width="4"/>',
            '<circle cx="250" cy="211" r="113" fill="#39523d" stroke="', hue, '" stroke-width="4"/>',
            '<path d="M250 288V174m0 24c-48-5-72-29-74-70 44 0 77 26 74 70m0 8c-2-48 26-76 74-81-2 49-23 75-74 81" stroke="', hue, '" stroke-width="13" fill="none" stroke-linejoin="round" stroke-linecap="round"/>',
            '<text x="250" y="366" text-anchor="middle" font-size="36" font-family="sans-serif" font-weight="700" fill="#eff6e8">', daysLabel, ' DAY STREAK</text>',
            '<text x="250" y="413" text-anchor="middle" font-size="21" font-family="sans-serif" fill="', hue, '">AGENT ORCHARD</text></svg>'
        ));
        string memory json = string(abi.encodePacked(
            '{"name":"Agent Orchard - ', label, '",',
            '"description":"Soulbound on-chain streak achievement for holders of official Agent ID on BNB Smart Chain. No financial promise.",',
            '"image":"data:image/svg+xml;base64,', OrchardBase64.encode(bytes(svg)), '",',
            '"attributes":[{"trait_type":"Streak days","value":', daysLabel, '},{"trait_type":"Transferability","value":"Soulbound"}]}'
        ));
        return string(abi.encodePacked("data:application/json;base64,", OrchardBase64.encode(bytes(json))));
    }
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f || interfaceId == 0xb45a3c0e;
    }
    function locked(uint256 tokenId) external view returns (bool) { ownerOf(tokenId); return true; }
    function approve(address, uint256) external pure { revert Soulbound(); }
    function setApprovalForAll(address, bool) external pure { revert Soulbound(); }
    function getApproved(uint256 tokenId) external view returns (address) { ownerOf(tokenId); return address(0); }
    function isApprovedForAll(address, address) external pure returns (bool) { return false; }
    function transferFrom(address, address, uint256) external pure { revert Soulbound(); }
    function safeTransferFrom(address, address, uint256) external pure { revert Soulbound(); }
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure { revert Soulbound(); }
}
