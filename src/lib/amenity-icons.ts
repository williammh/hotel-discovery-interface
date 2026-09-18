import type { Icon } from "@phosphor-icons/react"
import {
  AnchorIcon,
  ArmchairIcon,
  BarbellIcon,
  BathtubIcon,
  BeerSteinIcon,
  BicycleIcon,
  BreadIcon,
  ChefHatIcon,
  CoffeeIcon,
  DropIcon,
  EggIcon,
  FlowerLotusIcon,
  ForkKnifeIcon,
  GameControllerIcon,
  GarageIcon,
  KeyIcon,
  MartiniIcon,
  PawPrintIcon,
  PresentationIcon,
  SailboatIcon,
  ShoppingBagIcon,
  SparkleIcon,
  SunIcon,
  SuitcaseIcon,
  SwimmingPoolIcon,
  UmbrellaIcon,
  UsersThreeIcon,
  WashingMachineIcon,
  WifiHighIcon,
  WineIcon,
} from "@phosphor-icons/react/dist/ssr"

/**
 * Keyed on the seed's raw amenity strings (see `formatAmenity`). Shared by
 * every surface that shows an amenity — quick-filter chips, the filter
 * drawer, and the result card badges — so they never drift from each other.
 */
const AMENITY_ICONS: Record<string, Icon> = {
  afternoon_tea_lounge: CoffeeIcon,
  bar: MartiniIcon,
  beach_access: UmbrellaIcon,
  bicycle_rentals: BicycleIcon,
  courtyard_cafe: CoffeeIcon,
  courtyard_lounge: ArmchairIcon,
  fine_dining_terrace: ForkKnifeIcon,
  fitness_center: BarbellIcon,
  "free Wi-Fi": WifiHighIcon,
  free_breakfast: BreadIcon,
  free_parking: GarageIcon,
  gaming_lounge: GameControllerIcon,
  harbour_restaurant: AnchorIcon,
  hot_tub: BathtubIcon,
  laundry_service: WashingMachineIcon,
  luggage_storage: SuitcaseIcon,
  marina_access: SailboatIcon,
  meeting_rooms: PresentationIcon,
  michelin_restaurant: ChefHatIcon,
  on_site_pub: BeerSteinIcon,
  pet_friendly: PawPrintIcon,
  pool: SwimmingPoolIcon,
  public_hot_spring_bath: DropIcon,
  restaurant: ForkKnifeIcon,
  rooftop_bar: MartiniIcon,
  rooftop_terrace: SunIcon,
  rooftop_wine_bar: WineIcon,
  sky_bar: MartiniIcon,
  social_lounge: UsersThreeIcon,
  spa: FlowerLotusIcon,
  traditional_breakfast: EggIcon,
  valet_parking: KeyIcon,
  vending_galore: ShoppingBagIcon,
}

/** Sparkle stands in for any amenity string the seed introduces later. */
const DEFAULT_AMENITY_ICON: Icon = SparkleIcon

export function getAmenityIcon(amenity: string): Icon {
  return AMENITY_ICONS[amenity] ?? DEFAULT_AMENITY_ICON
}
