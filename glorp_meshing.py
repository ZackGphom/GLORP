# ---------------------------------------------------------
#  GLORP MESHING ENGINE v3.0
#  Lead Developer: Harry Tsang
#  (https://www.linkedin.com/in/cheuk-nam-tsang-2997671b3/)
#  High-speed contour tracing & shape optimization logic.
# ---------------------------------------------------------

import numpy as np

# Directional constants for edge tracing logic
CLOCKWISE = 1 
ANTICLOCKWISE = 2

def edge_finding(grid, color):
    """
    Identifies color boundaries using NumPy vector rolling.
    Detects horizontal and vertical transitions between the target color and background.
    """
    mask = np.where(grid == color)
    
    # Trace horizontal boundaries
    positive = np.zeros((grid.shape[0] + 1, grid.shape[1]), dtype=np.uint8)
    positive[mask] = 1
    rolled_negative = np.roll(1 - positive, 1, axis=0)
    hor_edges = (positive - rolled_negative == 0)
    hor_edges = hor_edges * ANTICLOCKWISE - (positive + rolled_negative == 2)
    
    # Trace vertical boundaries
    positive = np.zeros((grid.shape[0], grid.shape[1] + 1), dtype=np.uint8)
    positive[mask] = 1
    rolled_negative = np.roll(1 - positive, 1, axis=1)
    ver_edges = (positive - rolled_negative == 0)
    ver_edges = ver_edges * CLOCKWISE + (positive + rolled_negative == 2)
    
    return ver_edges, hor_edges

def explore_up(x, y, ver_edges, hor_edges):
    """ Recursive boundary follower: tracing upwards """
    for destX in range(x, -1, -1):
        if ver_edges[destX, y] == ANTICLOCKWISE:
            ver_edges[destX, y] = 0; continue
        else: break
    else: destX += -1
    path = f"v{destX - x}"
    if hor_edges[destX + 1, y] == CLOCKWISE: return path + explore_right(destX + 1, y, ver_edges, hor_edges)
    elif y > 0 and hor_edges[destX + 1, y - 1] == ANTICLOCKWISE: return path + explore_left(destX + 1, y - 1, ver_edges, hor_edges)
    return path

def explore_left(x, y, ver_edges, hor_edges):
    """ Recursive boundary follower: tracing leftwards """
    for destY in range(y, -1, -1):
        if hor_edges[x, destY] == ANTICLOCKWISE:
            hor_edges[x, destY] = 0; continue
        else: break
    else: destY += -1
    path = f"h{destY - y}"
    if x > 0 and ver_edges[x - 1, destY + 1] == ANTICLOCKWISE: return path + explore_up(x - 1, destY + 1, ver_edges, hor_edges)
    elif destY < ver_edges.shape[1] and ver_edges[x, destY + 1] == CLOCKWISE: return path + explore_down(x, destY + 1, ver_edges, hor_edges)
    return path

def explore_down(x, y, ver_edges, hor_edges):
    """ Recursive boundary follower: tracing downwards """
    for destX in range(x, ver_edges.shape[0]):
        if ver_edges[destX, y] == CLOCKWISE:
            ver_edges[destX, y] = 0; continue
        else: break
    else: destX += 1
    path = f"v{destX - x}"
    if y > 0 and hor_edges[destX, y - 1] == ANTICLOCKWISE: return path + explore_left(destX, y - 1, ver_edges, hor_edges)
    elif destX < hor_edges.shape[0] and hor_edges[destX, y] == CLOCKWISE: return path + explore_right(destX, y, ver_edges, hor_edges)
    return path

def explore_right(x, y, ver_edges, hor_edges):
    """ Recursive boundary follower: tracing rightwards """
    for destY in range(y, hor_edges.shape[1]):
        if hor_edges[x, destY] == CLOCKWISE:
            hor_edges[x, destY] = 0; continue
        else: break
    else: destY += 1
    path = f"h{destY - y}"
    if destY < ver_edges.shape[1] and ver_edges[x, destY] == CLOCKWISE: return path + explore_down(x, destY, ver_edges, hor_edges)
    elif x > 0 and ver_edges[x - 1, destY] == ANTICLOCKWISE: return path + explore_up(x - 1, destY, ver_edges, hor_edges)
    return path

def path_finding(grid, color):
    """
    Main path construction logic.
    Identifies color cluster boundaries and generates optimized SVG path data (M...z).
    Ensures that the right side of the path is the target color while the left side is background.
    """
    ver_edges, hor_edges = edge_finding(grid, color)
    path_data = ""
    while np.any(hor_edges):
        x, y = np.argwhere(hor_edges == CLOCKWISE)[0]
        path_data += f"M{y},{x}"
        path_data += explore_right(x, y, ver_edges, hor_edges)
        path_data += "z"
    return path_data