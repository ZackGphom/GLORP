# ---------------------------------------------------------
#  GLORP: The Pixel-to-Vector Beast
#  (c) 2026 ZackGphom. All rights reserved.
#  This code is for NON-COMMERCIAL use only. 
#  If you use this code, you MUST credit ZackGphom.
# ---------------------------------------------------------
#  SPECIAL THANKS TO:
#  Harry Tsang (https://www.linkedin.com/in/cheuk-nam-tsang-2997671b3/)
#  For the implementation of the high-performance Contour Meshing Engine.
# ---------------------------------------------------------

import numpy as np

CLOCKWISE = 1
ANTICLOCKWISE = 2

def edge_finding(grid, color):
    mask = np.where(grid == color)

    positive = np.zeros((grid.shape[0] + 1, grid.shape[1]), dtype=np.uint8)
    positive[mask] = 1
    rolled_negative = np.roll(1 - positive, 1, axis=0)
    hor_edges = (positive - rolled_negative == 0)
    hor_edges = hor_edges * ANTICLOCKWISE - (positive + rolled_negative == 2)

    positive = np.zeros((grid.shape[0], grid.shape[1] + 1), dtype=np.uint8)
    positive[mask] = 1
    rolled_negative = np.roll(1 - positive, 1, axis=1)
    ver_edges = (positive - rolled_negative == 0)
    ver_edges = ver_edges * CLOCKWISE + (positive + rolled_negative == 2)

    return ver_edges, hor_edges

def explore_up(x, y, ver_edges, hor_edges):
    for destX in range(x, -1, -1):
        if ver_edges[destX, y] == ANTICLOCKWISE:
            ver_edges[destX, y] = 0
        else:
            break
    else:
        destX -= 1
    path = f"v{destX - x}"
    if hor_edges[destX + 1, y] == CLOCKWISE:
        return path + explore_right(destX + 1, y, ver_edges, hor_edges)
    elif y > 0 and hor_edges[destX + 1, y - 1] == ANTICLOCKWISE:
        return path + explore_left(destX + 1, y - 1, ver_edges, hor_edges)
    return path

def explore_left(x, y, ver_edges, hor_edges):
    for destY in range(y, -1, -1):
        if hor_edges[x, destY] == ANTICLOCKWISE:
            hor_edges[x, destY] = 0
        else:
            break
    else:
        destY -= 1
    path = f"h{destY - y}"
    if x > 0 and ver_edges[x - 1, destY + 1] == ANTICLOCKWISE:
        return path + explore_up(x - 1, destY + 1, ver_edges, hor_edges)
    elif destY < ver_edges.shape[1] and ver_edges[x, destY + 1] == CLOCKWISE:
        return path + explore_down(x, destY + 1, ver_edges, hor_edges)
    return path

def explore_down(x, y, ver_edges, hor_edges):
    for destX in range(x, ver_edges.shape[0]):
        if ver_edges[destX, y] == CLOCKWISE:
            ver_edges[destX, y] = 0
        else:
            break
    else:
        destX += 1
    path = f"v{destX - x}"
    if y > 0 and hor_edges[destX, y - 1] == ANTICLOCKWISE:
        return path + explore_left(destX, y - 1, ver_edges, hor_edges)
    elif destX < hor_edges.shape[0] and hor_edges[destX, y] == CLOCKWISE:
        return path + explore_right(destX, y, ver_edges, hor_edges)
    return path

def explore_right(x, y, ver_edges, hor_edges):
    for destY in range(y, hor_edges.shape[1]):
        if hor_edges[x, destY] == CLOCKWISE:
            hor_edges[x, destY] = 0
        else:
            break
    else:
        destY += 1
    path = f"h{destY - y}"
    if destY < ver_edges.shape[1] and ver_edges[x, destY] == CLOCKWISE:
        return path + explore_down(x, destY, ver_edges, hor_edges)
    elif x > 0 and ver_edges[x - 1, destY] == ANTICLOCKWISE:
        return path + explore_up(x - 1, destY, ver_edges, hor_edges)
    return path

def path_finding(grid, color):
    ver_edges, hor_edges = edge_finding(grid, color)
    path_data = ""
    while np.any(hor_edges):
        x, y = np.argwhere(hor_edges == CLOCKWISE)[0]
        path_data += f"M{y},{x}"
        path_data += explore_right(x, y, ver_edges, hor_edges)
        path_data += "z"
    return path_data
