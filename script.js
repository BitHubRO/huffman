// --- Huffman Node --- 
class HuffmanNode {
    constructor(char, freq, left = null, right = null) {
        this.char = char;
        this.freq = freq;
        this.left = left;
        this.right = right;
    }
    isLeaf() {
        return this.left === null && this.right === null;
    }
}

// --- Huffman Encoding Function ---
function huffmanEncode(text) {
    if (!text) {
        return { codes: {}, tree: null, stats: { originalBits: 0, encodedBits: 0, ratio: 0 } };
    }
    const frequencies = {};
    for (const char of text) {
        frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let nodes = [];
    for (const char in frequencies) {
        nodes.push(new HuffmanNode(char, frequencies[char]));
    }
    while (nodes.length > 1) {
        nodes.sort((a, b) => a.freq - b.freq);
        const left = nodes.shift();
        const right = nodes.shift();
        const parent = new HuffmanNode(null, left.freq + right.freq, left, right);
        nodes.push(parent);
    }
    const treeRoot = nodes.length > 0 ? nodes[0] : null; // Handle empty input case better

    const huffmanCodes = {};
    function generateCodesRecursive(node, currentCode) {
        if (!node) return;
        if (node.isLeaf()) {
            huffmanCodes[node.char] = currentCode || '0'; // Handle single char case
            return;
        }
        generateCodesRecursive(node.left, currentCode + '0');
        generateCodesRecursive(node.right, currentCode + '1');
    }

    if (treeRoot && treeRoot.isLeaf()) {
        generateCodesRecursive(treeRoot, '0');
    } else {
        generateCodesRecursive(treeRoot, '');
    }

    const originalBits = text.length * 8;
    let encodedBits = 0;
    for (const char of text) {
        if (huffmanCodes[char]) { // Check if code exists
             encodedBits += huffmanCodes[char].length;
        }
    }
    const ratio = originalBits > 0 ? (1 - (encodedBits / originalBits)) * 100 : 0;

    return {
        codes: huffmanCodes,
        tree: treeRoot,
        stats: {
            originalLength: text.length,
            originalBits: originalBits,
            encodedBits: encodedBits,
            ratio: ratio.toFixed(2)
        }
    };
}


// --- Text Tree Visualization Helper --- (Keep the function from before)
function generateTreeText(node, indent = '', prefix = '') {
     if (!node) {
        return '';
    }
    let output = indent + prefix;
    if (node.isLeaf()) {
        const charDisplay = node.char === ' ' ? "' '" : node.char.replace(/</g, '<').replace(/>/g, '>');
        output += `Leaf: ${charDisplay} (Freq: ${node.freq})\n`;
    } else {
        output += `Node (Freq: ${node.freq})\n`;
        const childIndent = indent + '  ';
        output += generateTreeText(node.left, childIndent, '0: ');
        output += generateTreeText(node.right, childIndent, '1: ');
    }
    return output;
}

// --- NEW: Convert HuffmanNode to D3 compatible format ---
function convertNodeToD3(node) {
    if (!node) {
        return null;
    }

    let name = '';
    if (node.isLeaf()) {
        // Use 'SPACE' or similar for space character for better visibility in D3
        const charDisplay = node.char === ' ' ? "' '" : node.char;
        name = `${charDisplay} (${node.freq})`;
    } else {
        name = `(${node.freq})`; // Just frequency for internal nodes
    }

    const d3Node = { name: name, char: node.char, freq: node.freq }; // Include original char and freq

    if (!node.isLeaf()) {
        d3Node.children = [];
        const leftChild = convertNodeToD3(node.left);
        const rightChild = convertNodeToD3(node.right);
        if (leftChild) d3Node.children.push(leftChild);
        if (rightChild) d3Node.children.push(rightChild);
        // Ensure children array exists only if there are children
        if (d3Node.children.length === 0) {
            delete d3Node.children;
        }
    }

    return d3Node;
}


// --- NEW: D3 Tree Drawing Function ---
function drawHuffmanTree(d3Data, containerSelector) {
    const container = d3.select(containerSelector);
    container.html(''); // Clear previous drawing/message

    if (!d3Data) {
         container.append("p").text("No tree data to display.");
        return;
    }

    // --- Dimensions and Margins ---
    const margin = { top: 20, right: 120, bottom: 20, left: 120 }; // Adjusted margins
    const containerWidth = Math.max(600, container.node().getBoundingClientRect().width); // Get container width, ensure minimum
    let height = 500; // Initial height, might need adjustment

    // Calculate needed height dynamically based on tree depth (approximate)
    let maxDepth = 0;
    function findMaxDepth(node, depth) {
        if (!node) return;
        maxDepth = Math.max(maxDepth, depth);
        if (node.children) {
            node.children.forEach(child => findMaxDepth(child, depth + 1));
        }
    }
     findMaxDepth(d3Data, 0);
     height = Math.max(300, (maxDepth + 1) * 60); // Adjust height based on depth (e.g., 60px per level)


    const width = containerWidth - margin.left - margin.right;
    // Height might need dynamic calculation based on tree size


    // --- SVG Setup ---
    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Tree Layout ---
    const treemap = d3.tree().size([height, width]); // Use full height for vertical separation

    // --- Hierarchy ---
    let i = 0;
    const root = d3.hierarchy(d3Data, d => d.children);
    root.x0 = height / 2; // Start position for animation
    root.y0 = 0;

    // Assigns the x and y position for the nodes
    const treeData = treemap(root);

    // Compute the new tree layout.
    const nodes = treeData.descendants();
    const links = treeData.descendants().slice(1); // Exclude root's self-link

     // Normalize for fixed-depth (adjust spacing between levels)
    const depthFactor = 100; // Adjust this value to control horizontal spacing
    nodes.forEach(d => { d.y = d.depth * depthFactor; });

    // --- Nodes ---
    const node = svg.selectAll('g.node')
        .data(nodes, d => d.id || (d.id = ++i)); // Assign unique ID

    // Enter new nodes at the parent's previous position.
    const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        // Add class based on leaf/internal node
         .classed('node--leaf', d => !d.children)
         .classed('node--internal', d => d.children)
        .attr("transform", d => `translate(${root.y0},${root.x0})`) // Start from root pos
        .style("opacity", 0); // Start transparent

    nodeEnter.append('circle')
        .attr('r', 10); // Node radius

    nodeEnter.append('text')
        .attr("dy", ".35em")
        .attr("x", d => d.children ? -13 : 13) // Position text left/right of node
        .attr("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);

    // Transition nodes to their new position.
    const nodeUpdate = nodeEnter.merge(node); // Combine enter and update selections

    nodeUpdate.transition()
        .duration(500) // Animation duration
        .attr("transform", d => `translate(${d.y},${d.x})`)
         .style("opacity", 1); // Fade in

    nodeUpdate.select('circle')
        .attr('r', 10);
        // Style based on data if needed

    // Transition exiting nodes to the parent's new position.
    const nodeExit = node.exit().transition()
        .duration(500)
        .attr("transform", d => `translate(${root.y},${root.x})`) // Exit towards root pos
        .style("opacity", 0)
        .remove();

    nodeExit.select('circle').attr('r', 1e-6); // Shrink circle on exit
    nodeExit.select('text').style('fill-opacity', 1e-6); // Fade text on exit

    // --- Links ---
     // Function to create diagonal paths
    function diagonal(s, d) {
        const path = `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        return path;
    }

    const link = svg.selectAll('path.link')
        .data(links, d => d.id);

    // Enter new links at the parent's previous position.
    const linkEnter = link.enter().insert('path', "g") // Insert links behind nodes
        .attr("class", "link")
        .attr('d', d => {
            const o = { x: root.x0, y: root.y0 }; // Start from root pos
            return diagonal(o, o);
        })
        .style("opacity", 0); // Start transparent

    // Transition links to their new position.
    linkEnter.merge(link).transition() // Combine enter and update
        .duration(500)
        .attr('d', d => diagonal(d.parent, d)) // Use parent position for source
        .style("opacity", 1); // Fade in


    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
        .duration(500)
        .attr('d', d => {
            const o = { x: root.x, y: root.y }; // Exit towards root pos
            return diagonal(o, o);
        })
        .style("opacity", 0)
        .remove();

    // Stash the old positions for transition.
    nodes.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}


// --- DOM Manipulation ---
const inputText = document.getElementById('inputText');
const generateButton = document.getElementById('generateButton');
const codesOutputDiv = document.getElementById('codesOutput');
const statsOutputDiv = document.getElementById('statsOutput');
const d3Container = document.getElementById('d3TreeContainer');

generateButton.addEventListener('click', () => {
    const text = inputText.value;
    const { codes, tree, stats } = huffmanEncode(text);

     // --- Convert tree for D3 ---
     const d3FormattedData = convertNodeToD3(tree);

     // --- Draw D3 Tree ---
     if (d3FormattedData) {
        drawHuffmanTree(d3FormattedData, '#d3TreeContainer');
     } else {
        d3Container.innerHTML = '<p>No tree to display (input might be empty).</p>'; // Clear/message D3 container
     }


    // --- Display Codes --- (Same as before, maybe clear message first)
    codesOutputDiv.innerHTML = '<h3>Character Codes:</h3>'; // Clear previous
     if (Object.keys(codes).length > 0) {
        const table = document.createElement('table');
        table.id = 'codesTable';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        headerRow.insertCell().textContent = 'Character';
        headerRow.insertCell().textContent = 'Huffman Code';
        headerRow.insertCell().textContent = 'Frequency';

        const tbody = table.createTBody();
        const charFreqMap = {};
        function findLeaves(node) { if (!node) return; if (node.isLeaf()) { charFreqMap[node.char] = node.freq; } else { findLeaves(node.left); findLeaves(node.right); } }
        findLeaves(tree);
        const sortedChars = Object.keys(codes).sort((a, b) => { const lenDiff = codes[a].length - codes[b].length; if (lenDiff !== 0) return lenDiff; return a.localeCompare(b); });

        for (const char of sortedChars) {
            const row = tbody.insertRow();
            const charDisplay = char === ' ' ? "' '" : char;
            row.insertCell().textContent = charDisplay.replace(/</g, '<').replace(/>/g, '>');
            row.insertCell().textContent = codes[char];
            row.insertCell().textContent = charFreqMap[char] || '-';
        }
        codesOutputDiv.appendChild(table);
    } else if (text.length === 0) {
         codesOutputDiv.innerHTML += '<p>Enter some text first.</p>';
    } else {
        codesOutputDiv.innerHTML += '<p>No codes generated.</p>';
    }

   

     // --- Display Stats --- (Same as before)
    statsOutputDiv.innerHTML = '<h3>Compression Stats:</h3>'; // Clear previous
     if (stats && stats.originalBits > 0) {
        statsOutputDiv.innerHTML += `<p>Original Length: ${stats.originalLength} characters</p>`;
        statsOutputDiv.innerHTML += `<p>Original Size: ≈ ${stats.originalBits} bits (assuming 8 bits/char)</p>`;
        statsOutputDiv.innerHTML += `<p>Encoded Size: ${stats.encodedBits} bits</p>`;
        statsOutputDiv.innerHTML += `<p>Compression Ratio: ${stats.ratio}% reduction</p>`;
    } else if (text.length > 0) {
         statsOutputDiv.innerHTML += `<p>Original Length: ${stats.originalLength} characters</p>`;
         statsOutputDiv.innerHTML += `<p>Original Size: ≈ ${stats.originalBits} bits</p>`;
         statsOutputDiv.innerHTML += `<p>Encoded Size: ${stats.encodedBits} bits</p>`;
         statsOutputDiv.innerHTML += `<p>Cannot calculate ratio (or input was trivial).</p>`;
    } else {
        statsOutputDiv.innerHTML += '<p>Enter text to see stats.</p>';
    }
});