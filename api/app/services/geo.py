from typing import List, Tuple
from shapely.geometry import Polygon, shape, mapping
from shapely.ops import transform
from shapely.validation import make_valid
from pyproj import Transformer

TRANSFORM_31700_TO_4326 = Transformer.from_crs("EPSG:31700", "EPSG:4326", always_xy=True)
TRANSFORM_4326_TO_32634 = Transformer.from_crs("EPSG:4326", "EPSG:32634", always_xy=True)


def stereo70_to_wgs84(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    out = []
    for x, y in points:
        lon, lat = TRANSFORM_31700_TO_4326.transform(x, y)
        out.append((lon, lat))
    return out


def points_to_polygon(points_wgs84: List[Tuple[float, float]]) -> Polygon:
    if len(points_wgs84) < 3:
        raise ValueError("Not enough points to build polygon")
    if points_wgs84[0] != points_wgs84[-1]:
        points_wgs84 = points_wgs84 + [points_wgs84[0]]
    poly = Polygon(points_wgs84)
    if not poly.is_valid:
        poly = make_valid(poly)
    if poly.geom_type == "MultiPolygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    return poly


def geojson_to_shape(geojson: dict):
    geom = shape(geojson)
    if not geom.is_valid:
        geom = make_valid(geom)
    if geom.geom_type == "MultiPolygon":
        geom = max(geom.geoms, key=lambda g: g.area)
    return geom


def shape_to_geojson(geom) -> dict:
    return mapping(geom)


def area_m2(geom) -> float:
    projected = transform(TRANSFORM_4326_TO_32634.transform, geom)
    return projected.area
