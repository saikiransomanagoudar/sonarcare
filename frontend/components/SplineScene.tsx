"use client";

import { useEffect, useState, useRef } from "react";

// Update this version number whenever you update your Spline design
const SPLINE_VERSION = "1.1";

export default function SplineScene() {
  const [SplineComponent, setSplineComponent] = useState<any>(null);
  const [splineApp, setSplineApp] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [objectNames, setObjectNames] = useState<string[]>([]);
  const [sceneKey, setSceneKey] = useState(0);

  // Reference to track which events exist in the scene
  const eventsRef = useRef<{ lookAt: boolean; events: string[] }>({
    lookAt: false,
    events: [],
  });

  useEffect(() => {
    // Import Spline dynamically only on the client side
    import("@splinetool/react-spline").then((module) => {
      setSplineComponent(() => module.default);
    });

    // Add keyboard shortcut to toggle debug mode (Ctrl+Shift+D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setDebugMode((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Clean up event listeners when component unmounts
    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (splineApp) {
        try {
          console.log("Cleaning up Spline events");
        } catch (e) {
          console.error("Error cleaning up Spline:", e);
        }
      }
    };
  }, [splineApp]);

  // Separate useEffect for mouse move to minimize rerenders
  useEffect(() => {
    // Direct mouse event handling
    const handleMouseMove = (e: MouseEvent) => {
      if (!splineApp) return;

      const x = e.clientX;
      const y = e.clientY;

      setMousePos({ x, y });

      // Only log in debug mode to avoid console spam
      if (debugMode) {
        console.log("Mouse position:", x, y);
      }

      try {
        // Try to manually trigger look-at behavior if it exists
        const lookAtObj =
          splineApp.findObjectByName("LookAt") ||
          splineApp.findObjectByName("Look") ||
          splineApp.findObjectByName("HeadLookAt");

        if (lookAtObj && eventsRef.current.lookAt) {
          // Manually update look-at target position
          // This is a common approach for look-at behavior in Spline
          if (lookAtObj.position) {
            // Convert mouse coordinates to world space (simplified)
            // May need adjustments based on your specific scene setup
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Map mouse position to [-1, 1] range for x and y
            const normalizedX = (x / viewportWidth) * 2 - 1;
            const normalizedY = -(y / viewportHeight) * 2 + 1;

            // Set look-at target position with some depth
            // The scale factors control sensitivity
            lookAtObj.position.x = normalizedX * 5;
            lookAtObj.position.y = normalizedY * 5;
            lookAtObj.position.z = 5; // Fixed depth

            if (debugMode) {
              console.log("Updated look-at position:", lookAtObj.position);
            }
          }
        }
      } catch (error) {
        if (debugMode) {
          console.error("Error handling mouse event:", error);
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [splineApp, debugMode]);

  const onLoad = (spline: any) => {
    // Store the spline app instance
    setSplineApp(spline);
    console.log("Spline scene loaded successfully");

    // You can access the Spline API here
    if (spline) {
      try {
        // Explicitly enable all event passing
        if (spline.canvas) {
          console.log("Canvas found, enabling event passing");
          // Force the canvas to receive all events
          spline.canvas.style.pointerEvents = "auto";
          spline.canvas.style.zIndex = "1";

          // Try to set other canvas properties that might help
          spline.canvas.style.touchAction = "auto";
          spline.canvas.style.position = "absolute";
        }

        // Check for runtime and scene
        if (spline.runtime && spline.runtime.scene) {
          console.log("Runtime and scene available");

          // Try to disable any controls that might interfere
          if (spline.runtime.orbitControls) {
            spline.runtime.orbitControls.enabled = false;
            console.log("Disabled orbit controls");
          }
        }

        // Attempt to identify look-at objects or events
        const lookAtObj =
          spline.findObjectByName("LookAt") ||
          spline.findObjectByName("Look") ||
          spline.findObjectByName("HeadLookAt");

        if (lookAtObj) {
          console.log("Found look-at object:", lookAtObj.name);
          eventsRef.current.lookAt = true;
        }

        // Log all available objects to debug
        console.log("All Spline objects:");
        const allObjects = spline.getAllObjects();
        const names: string[] = [];
        const events: string[] = [];

        if (allObjects) {
          allObjects.forEach((obj: any) => {
            names.push(`${obj.name} (${obj.type})`);

            // Check if this object has any events
            if (obj.events && Object.keys(obj.events).length > 0) {
              console.log(`Object with events: ${obj.name}`, obj.events);
              events.push(`${obj.name}: ${Object.keys(obj.events).join(", ")}`);
            }

            // If this is an interactive object, log details
            if (
              obj.name.toLowerCase().includes("look") ||
              obj.name.toLowerCase().includes("head") ||
              obj.name.toLowerCase().includes("face") ||
              obj.name.toLowerCase().includes("eye")
            ) {
              console.log("Found potential interactive object:", obj);
            }
          });
          setObjectNames(names);
          eventsRef.current.events = events;
        }
      } catch (error) {
        console.error("Error setting up Spline interaction:", error);
      }
    }
  };

  if (!SplineComponent) {
    return null;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 w-full h-full overflow-hidden"
        style={{ pointerEvents: "auto", clipPath: "inset(64px 0 0 0)" }}
      >
        <SplineComponent
          scene={`https://prod.spline.design/al3F-8TlaFrhgSVg/scene.splinecode?v=${SPLINE_VERSION}`}
          onLoad={onLoad}
        />
      </div>

      {/* Debug overlay - toggle with Ctrl+Shift+D */}
      {debugMode && (
        <div className="fixed top-0 left-0 p-4 bg-black bg-opacity-70 text-white z-50 text-xs font-mono max-w-xs max-h-[80vh] overflow-auto">
          <h3 className="text-green-400 mb-2">
            Spline Debug (Ctrl+Shift+D to hide)
          </h3>
          <p>
            Mouse: x={mousePos.x}, y={mousePos.y}
          </p>
          <p>Spline loaded: {splineApp ? "Yes" : "No"}</p>
          <p>Look-at object found: {eventsRef.current.lookAt ? "Yes" : "No"}</p>

          {eventsRef.current.events.length > 0 && (
            <div className="mt-2">
              <p className="text-yellow-400">Events found:</p>
              <ul className="pl-2 mt-1">
                {eventsRef.current.events.map((event, i) => (
                  <li key={i} className="text-gray-300">
                    {event}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-2">
            <p className="text-yellow-400">Objects in scene:</p>
            <ul className="pl-2 mt-1">
              {objectNames.map((name, i) => (
                <li key={i} className="text-gray-300">
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              className="px-2 py-1 bg-blue-600 rounded"
              onClick={() => {
                // Reset look-at position to center
                if (splineApp) {
                  try {
                    const lookAtObj =
                      splineApp.findObjectByName("LookAt") ||
                      splineApp.findObjectByName("Look") ||
                      splineApp.findObjectByName("HeadLookAt");

                    if (lookAtObj && lookAtObj.position) {
                      lookAtObj.position.set(0, 0, 5);
                      console.log("Reset look-at position");
                    }
                  } catch (error) {
                    console.error("Error:", error);
                  }
                }
              }}
            >
              Reset Position
            </button>

            <button
              className="px-2 py-1 bg-red-600 rounded"
              onClick={() => {
                // Toggle look-at behavior
                eventsRef.current.lookAt = !eventsRef.current.lookAt;
                console.log(
                  "Look-at behavior:",
                  eventsRef.current.lookAt ? "Enabled" : "Disabled"
                );
              }}
            >
              Toggle Look-at
            </button>
          </div>
        </div>
      )}
    </>
  );
}
