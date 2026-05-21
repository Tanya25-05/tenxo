import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function NodesList({ apiUrl, token }) {
  const [nodes, setNodes] = useState([]);
  const prevCount = useRef(0);

  useEffect(() => {
    let mounted = true;
    async function fetchNodes() {
      try {
        const res = await fetch(`${apiUrl}/my-nodes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setNodes(data.nodes || []);
      } catch (e) {
        console.error(e);
      }
    }
    fetchNodes();
    const id = setInterval(fetchNodes, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [apiUrl, token]);

  useEffect(() => {
    prevCount.current = nodes.length;
  }, [nodes]);

  return (
    <div>
      <div className="flex items-center mb-4">
        <h3 className="text-2xl font-semibold mr-4">Active GPUs</h3>
        <motion.div
          key={nodes.length}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="text-2xl font-bold"
        >
          {nodes.length}
        </motion.div>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {nodes.map((n) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              key={n.node_id}
              className="card p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-medium">{n.node_id}</div>
                <div className="text-sm muted">
                  {n.status} • {n.ttl_seconds}s
                </div>
              </div>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.8, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-3 h-3 rounded-full bg-green-400"
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
